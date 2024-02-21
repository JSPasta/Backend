import type { Parameters } from '../types/DocumentHandler.ts';
import { ServerEndpointVersion } from '../types/Server.ts';
import { ValidatorUtils } from '../utils/ValidatorUtils.ts';
import { JSPError } from './JSPError.ts';
import { JSPErrorCode, type JSPErrorSchema } from '../types/JSPError.ts';
import { Server } from './Server.ts';
import { DocumentManager } from './DocumentManager.ts';
import { unlink } from 'node:fs/promises';
import { StringUtils } from '../utils/StringUtils.ts';
import type { IDocumentDataStruct } from '../structures/Structures';
import type { BunFile } from 'bun';

export class DocumentHandler {
	private context: any;

	public set setContext(value: any) {
		this.context = value;
	}

	public async access(params: Parameters['access'], version: ServerEndpointVersion) {
		switch (version) {
			case ServerEndpointVersion.v1: {
				this.validateKey(params[version].key);

				const file = await this.validateKeyExistance(params[version].key);
				if (ValidatorUtils.isJSPError(file)) return file;

				const document = await DocumentManager.read(file);

				this.validateTimestamp(params[version].key, document.expirationTimestamp);

				const data = new TextDecoder().decode(document.rawFileData);

				return { key: params[version].key, data };
			}

			case ServerEndpointVersion.v2: {
				this.validateKey(params[version].key);

				const file = await this.validateKeyExistance(params[version].key);
				if (ValidatorUtils.isJSPError(file)) return file;

				const document = await DocumentManager.read(file);

				this.validateTimestamp(params[version].key, document.expirationTimestamp);
				this.validatePassword(params[version].password, document.password);

				const data = new TextDecoder().decode(document.rawFileData);

				return {
					key: params[version].key,
					data,
					url: Server.hostname.concat('/', params[version].key),
					expirationTimestamp: document.expirationTimestamp
				};
			}
		}
	}

	public async edit(params: Parameters['edit']) {
		this.validateKey(params.key);

		const file = await this.validateKeyExistance(params.key);
		if (ValidatorUtils.isJSPError(file)) return file;

		const document = await DocumentManager.read(file);

		this.validateSecret(params.secret, document.secret);

		const buffer = Buffer.from(params.body as ArrayBuffer);

		this.validateSizeBetweenLimits(buffer);

		document.rawFileData = buffer;

		return {
			edited: await DocumentManager.write(Server.config.documents.documentPath + params.key, document)
				.then(() => true)
				.catch(() => false)
		};
	}

	public async exists(params: Parameters['exists']) {
		this.validateKey(params.key);

		return Bun.file(Server.config.documents.documentPath + params.key).exists();
	}

	public async publish(params: Parameters['publish'], version: ServerEndpointVersion) {
		const bodyBuffer = Buffer.from(params[version].body as ArrayBuffer);

		switch (version) {
			case ServerEndpointVersion.v1: {
				const secret = StringUtils.createSecret();

				this.validateSizeBetweenLimits(bodyBuffer);

				const key = await StringUtils.createKey();

				const document: IDocumentDataStruct = {
					rawFileData: bodyBuffer,
					secret
				};

				await DocumentManager.write(Server.config.documents.documentPath + key, document);

				return { key, secret };
			}

			case ServerEndpointVersion.v2: {
				const secret = params[version].selectedSecret || StringUtils.createSecret();

				this.validateSecretLength(secret);
				this.validatePasswordLength(params[version].password);
				this.validateSelectedKey(params[version].selectedKey);
				this.validateSelectedKeyLength(params[version].selectedKeyLength);
				this.validateSizeBetweenLimits(bodyBuffer);

				let lifetime = params[version].lifetime ?? Server.config.documents.maxTime;

				// Make the document permanent if the value exceeds 5 years
				if (lifetime > 157_784_760) lifetime = 0;

				const msLifetime = lifetime * 1000;
				const expirationTimestamp = msLifetime > 0 ? BigInt(Date.now() + msLifetime) : undefined;

				const key =
					params[version].selectedKey ||
					(await StringUtils.createKey(params[version].selectedKeyLength ?? 8));

				if (params[version].selectedKey && (await StringUtils.keyExists(key)))
					throw JSPError.send(this.context, 400, JSPError.message[JSPErrorCode.documentKeyAlreadyExists]);

				const document: IDocumentDataStruct = {
					rawFileData: bodyBuffer,
					secret,
					expirationTimestamp,
					password: params[version].password
				};

				await DocumentManager.write(Server.config.documents.documentPath + key, document);

				return {
					key,
					secret,
					url: Server.hostname.concat('/', key),
					expirationTimestamp: Number(expirationTimestamp ?? 0)
				};
			}
		}
	}

	public async remove(params: Parameters['remove']) {
		this.validateKey(params.key);

		const file = await this.validateKeyExistance(params.key);
		if (ValidatorUtils.isJSPError(file)) return file;

		const document = await DocumentManager.read(file);

		this.validateSecret(params.secret, document.secret);

		return {
			removed: await unlink(Server.config.documents.documentPath + params.key)
				.then(() => true)
				.catch(() => false)
		};
	}

	private validateKey(key: string): JSPErrorSchema | undefined {
		if (!ValidatorUtils.isAlphanumeric(key) || !ValidatorUtils.isStringLengthBetweenLimits(key, 2, 32)) {
			return JSPError.send(this.context, 400, JSPError.message[JSPErrorCode.inputInvalid]);
		}

		return undefined;
	}

	private async validateKeyExistance(key: string): Promise<JSPErrorSchema | BunFile> {
		const file = Bun.file(Server.config.documents.documentPath + key);

		if (!(await file.exists())) {
			return JSPError.send(this.context, 404, JSPError.message[JSPErrorCode.documentNotFound]);
		}

		return file;
	}

	private validateSecret(secret: string | undefined, documentSecret: string): JSPErrorSchema | undefined {
		if (documentSecret && documentSecret !== secret) {
			throw JSPError.send(this.context, 403, JSPError.message[JSPErrorCode.documentInvalidSecret]);
		}

		return undefined;
	}

	private validateSecretLength(secret: string): JSPErrorSchema | undefined {
		if (!ValidatorUtils.isStringLengthBetweenLimits(secret || '', 1, 255)) {
			return JSPError.send(this.context, 400, JSPError.message[JSPErrorCode.documentInvalidSecretLength]);
		}

		return undefined;
	}

	private validatePassword(
		password: string | undefined,
		documentPassword: string | null | undefined
	): JSPErrorSchema | undefined {
		if (documentPassword && documentPassword !== password) {
			return JSPError.send(this.context, 403, JSPError.message[JSPErrorCode.documentInvalidPassword]);
		}

		return undefined;
	}

	private validatePasswordLength(password: string | undefined): JSPErrorSchema | undefined {
		if (password && !ValidatorUtils.isStringLengthBetweenLimits(password, 0, 255)) {
			return JSPError.send(this.context, 400, JSPError.message[JSPErrorCode.documentInvalidPasswordLength]);
		}

		return undefined;
	}

	private validateTimestamp(key: string, timestamp: number): JSPErrorSchema | undefined {
		if (timestamp && ValidatorUtils.isLengthBetweenLimits(timestamp, 0, Date.now())) {
			unlink(Server.config.documents.documentPath + key);

			return JSPError.send(this.context, 404, JSPError.message[JSPErrorCode.documentNotFound]);
		}

		return undefined;
	}

	private validateSizeBetweenLimits(body: Buffer): JSPErrorSchema | undefined {
		if (!ValidatorUtils.isLengthBetweenLimits(body, 1, Server.config.documents.maxLength)) {
			return JSPError.send(this.context, 400, JSPError.message[JSPErrorCode.documentInvalidLength]);
		}

		return undefined;
	}

	private validateSelectedKey(key: string | undefined): JSPErrorSchema | undefined {
		if (key && (!ValidatorUtils.isStringLengthBetweenLimits(key, 2, 32) || !ValidatorUtils.isAlphanumeric(key))) {
			return JSPError.send(this.context, 400, JSPError.message[JSPErrorCode.inputInvalid]);
		}

		return undefined;
	}

	private validateSelectedKeyLength(length: number | undefined): JSPErrorSchema | undefined {
		if (length && ValidatorUtils.isLengthBetweenLimits(length, 2, 32)) {
			return JSPError.send(this.context, 400, JSPError.message[JSPErrorCode.documentInvalidKeyLength]);
		}

		return undefined;
	}
}
