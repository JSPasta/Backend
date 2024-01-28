import { unlink } from 'node:fs/promises';
import { DataValidator } from './DataValidator';
import { DocumentManager } from './DocumentManager';
import { createKey, createSecret } from '../utils/createKey.ts';
import type { DocumentDataStruct } from '../structures/documentStruct.ts';
import {
	APIVersions,
	JSPErrorCode,
	basePath,
	defaultDocumentLifetime,
	maxDocLength,
	viewDocumentPath
} from '../utils/constants.ts';
import { ErrorSender } from './ErrorSender.ts';

export class DocumentHandler {
	static async handleAccess(
		{
			errorSender,
			key,
			password
		}: {
			errorSender: ErrorSender;
			key: string;
			password?: string;
		},
		version: APIVersions
	) {
		if (!DataValidator.isAlphanumeric(key))
			return errorSender.sendError(400, {
				type: 'error',
				errorCode: JSPErrorCode.inputInvalid,
				message: 'The provided document key is not alphanumeric'
			});

		const file = Bun.file(basePath + key);

		const fileExists = await file.exists();

		const doc = fileExists && (await DocumentManager.read(file));

		if (
			!doc ||
			(doc.expirationTimestamp &&
				doc.expirationTimestamp > 0 &&
				doc.expirationTimestamp <= Date.now())
		) {
			if (fileExists) await unlink(basePath + key).catch(() => null);

			return errorSender.sendError(404, {
				type: 'error',
				errorCode: JSPErrorCode.documentNotFound,
				message: 'The requested document does not exist'
			});
		}

		if (doc.password && !password)
			return errorSender.sendError(401, {
				type: 'error',
				errorCode: JSPErrorCode.documentPasswordNeeded,
				message: 'This document requires credentials, however none were provided.'
			});

		if (doc.password && doc.password !== password)
			return errorSender.sendError(403, {
				type: 'error',
				errorCode: JSPErrorCode.documentInvalidPassword,
				message: 'Invalid credentials provided for the document.'
			});

		const data = new TextDecoder().decode(doc.rawFileData);

		switch (version) {
			case APIVersions.v1:
				return {
					key,
					data
				};
			case APIVersions.v2:
				return {
					key,
					data,
					url: viewDocumentPath + key,
					expirationTimestamp: Number(doc.expirationTimestamp)
				};
		}
	}

	static async handleRawAccess(
		{
			errorSender,
			key,
			password
		}: {
			errorSender: ErrorSender;
			key: string;
			password?: string;
		},
		version: APIVersions
	) {
		return DocumentHandler.handleAccess({ errorSender, key: key, password }, version).then(
			(res) => (ErrorSender.isJSPError(res) ? res : res.data)
		);
	}

	static async handleEdit({
		errorSender,
		key,
		newBody,
		secret
	}: {
		errorSender: ErrorSender;
		key: string;
		newBody: any;
		secret?: string;
	}) {
		if (!DataValidator.isAlphanumeric(key))
			return errorSender.sendError(400, {
				type: 'error',
				errorCode: JSPErrorCode.inputInvalid,
				message: 'The provided document ID is not alphanumeric'
			});

		const file = Bun.file(basePath + key);

		const fileExists = await file.exists();

		if (!fileExists)
			return errorSender.sendError(404, {
				type: 'error',
				errorCode: JSPErrorCode.documentNotFound,
				message: 'The requested document does not exist'
			});

		const buffer = Buffer.from(newBody as ArrayBuffer);

		if (!DataValidator.isLengthBetweenLimits(buffer, 1, maxDocLength))
			return errorSender.sendError(400, {
				type: 'error',
				errorCode: JSPErrorCode.documentInvalidLength,
				message: 'The document data length is invalid'
			});

		const doc = await DocumentManager.read(file);

		if (doc.secret && doc.secret !== secret)
			return errorSender.sendError(403, {
				type: 'error',
				errorCode: JSPErrorCode.documentInvalidSecret,
				message: 'Invalid secret provided'
			});

		doc.rawFileData = buffer;

		await DocumentManager.write(basePath + key, doc);

		return { message: 'File updated successfully' };
	}

	static async handleExists({ errorSender, key }: { errorSender: ErrorSender; key: string }) {
		if (!DataValidator.isAlphanumeric(key))
			return errorSender.sendError(400, {
				type: 'error',
				errorCode: JSPErrorCode.inputInvalid,
				message: 'The provided document ID is not alphanumeric'
			});

		const file = Bun.file(basePath + key);

		const fileExists = await file.exists();

		return fileExists;
	}

	static async handlePublish(
		{
			errorSender,
			body,
			selectedSecret,
			lifetime,
			password
		}: {
			errorSender: ErrorSender;
			body: any;
			selectedSecret?: string;
			lifetime?: number;
			password?: string;
		},
		version: APIVersions
	) {
		const buffer = Buffer.from(body as ArrayBuffer);

		if (!DataValidator.isLengthBetweenLimits(buffer, 1, maxDocLength))
			return errorSender.sendError(400, {
				type: 'error',
				errorCode: JSPErrorCode.documentInvalidLength,
				message: 'The document data length is invalid'
			});

		const secret = selectedSecret || createSecret();

		if (!DataValidator.isStringLengthBetweenLimits(secret ?? '', 1, 254))
			return errorSender.sendError(400, {
				type: 'error',
				errorCode: JSPErrorCode.documentInvalidSecretLength,
				message: 'The provided secret length is invalid'
			});

		if (password && !DataValidator.isStringLengthBetweenLimits(password, 0, 254))
			return errorSender.sendError(400, {
				type: 'error',
				errorCode: JSPErrorCode.documentInvalidPasswordLength,
				message: 'The provided password length is invalid'
			});

		// Make the document permanent if the value exceeds 5 years
		if ((lifetime ?? 0) > 157_784_760) lifetime = 0;

		const expirationTimestamp =
			(lifetime ?? defaultDocumentLifetime) * 1000 > 0
				? Date.now() + (lifetime ?? defaultDocumentLifetime) * 1000
				: undefined;

		const newDoc: DocumentDataStruct = {
			rawFileData: buffer,
			secret,
			expirationTimestamp:
				typeof expirationTimestamp === 'number' ? BigInt(expirationTimestamp) : undefined,
			password
		};

		const selectedKey = await createKey();

		await DocumentManager.write(basePath + selectedKey, newDoc);

		switch (version) {
			case APIVersions.v1:
				return { key: selectedKey, secret };
			case APIVersions.v2:
				return {
					key: selectedKey,
					secret,
					url: viewDocumentPath + selectedKey,
					expirationTimestamp
				};
		}
	}

	static async handleRemove({
		errorSender,
		key,
		secret
	}: {
		errorSender: ErrorSender;
		key: string;
		secret: string;
	}) {
		if (!DataValidator.isAlphanumeric(key))
			return errorSender.sendError(400, {
				type: 'error',
				errorCode: JSPErrorCode.inputInvalid,
				message: 'The provided document ID is not alphanumeric'
			});

		const file = Bun.file(basePath + key);

		const fileExists = await file.exists();

		if (!fileExists)
			return errorSender.sendError(404, {
				type: 'error',
				errorCode: JSPErrorCode.documentNotFound,
				message: 'The requested document does not exist'
			});

		const doc = await DocumentManager.read(file);

		if (doc.secret && doc.secret !== secret)
			return errorSender.sendError(403, {
				type: 'error',
				errorCode: JSPErrorCode.documentInvalidSecret,
				message: 'Invalid secret provided'
			});

		// FIXME: Use bun
		await unlink(basePath + key);

		return { message: 'File removed successfully' };
	}
}
