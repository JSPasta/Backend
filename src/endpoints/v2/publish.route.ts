import { type OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { compression } from '../../document/compression.ts';
import { crypto } from '../../document/crypto.ts';
import { storage } from '../../document/storage.ts';
import { validator } from '../../document/validator.ts';
import { errorHandler, schema } from '../../errorHandler.ts';
import { middleware } from '../../middleware.ts';
import { config } from '../../server.ts';
import { ErrorCode } from '../../types/ErrorHandler.ts';
import { StringUtils } from '../../utils/StringUtils.ts';

export const publishRoute = (endpoint: OpenAPIHono): void => {
	const route = createRoute({
		method: 'post',
		path: '/',
		tags: ['v2'],
		summary: 'Publish document',
		middleware: [middleware.bodyLimit()],
		request: {
			body: {
				content: {
					'text/plain': {
						schema: z.string().openapi({
							description: 'Data to publish in the document',
							example: 'Hello, World!'
						})
					}
				}
			},
			headers: z.object({
				password: z.string().optional().openapi({
					description: 'The password to encrypt the document',
					example: 'aabbccdd11223344'
				}),
				key: z.string().optional().openapi({
					description: 'The document name (formerly key)',
					example: 'abc123'
				}),
				keylength: z.number().optional().openapi({
					description: 'The document name length (formerly key length)',
					example: config.documentNameLengthDefault
				}),
				secret: z.string().optional().openapi({
					description: 'The document secret',
					example: 'aaaaa-bbbbb-ccccc-ddddd'
				})
			})
		},
		responses: {
			200: {
				content: {
					'application/json': {
						schema: z.object({
							key: z.string().openapi({
								description: 'The document name (formerly key)',
								example: 'abc123'
							}),
							secret: z.string().openapi({
								description: 'The document secret',
								example: 'aaaaa-bbbbb-ccccc-ddddd'
							}),
							url: z.string().openapi({
								description: 'The document URL',
								example: 'https://jspaste.eu/abc123'
							}),
							expirationTimestamp: z.number().openapi({
								deprecated: true,
								description: 'The document expiration timestamp (always will be 0)',
								example: 0
							})
						})
					}
				},
				description: 'An object with a "key", "secret" and "url" parameters of the created document'
			},
			400: schema,
			404: schema,
			500: schema
		}
	});

	endpoint.openapi(
		route,
		async (ctx) => {
			const body = await ctx.req.arrayBuffer();
			const headers = ctx.req.valid('header');

			if (headers.password) {
				validator.validatePasswordLength(headers.password);
			}

			let secret: string;

			if (headers.secret) {
				validator.validateSecretLength(headers.secret);

				secret = headers.secret;
			} else {
				secret = StringUtils.createSecret();
			}

			let name: string;

			if (headers.key) {
				validator.validateName(headers.key);

				if (await StringUtils.nameExists(headers.key)) {
					errorHandler.send(ErrorCode.documentNameAlreadyExists);
				}

				name = headers.key;
			} else {
				validator.validateNameLength(headers.keylength);

				name = await StringUtils.createName(headers.keylength);
			}

			const data = await compression.encode(body);

			await storage.write(name, {
				data: headers.password ? crypto.encrypt(data, headers.password) : data,
				header: {
					name: name,
					secretHash: crypto.hash(secret) as string,
					passwordHash: headers.password ? (crypto.hash(headers.password) as string) : null
				}
			});

			return ctx.json({
				key: name,
				secret: secret,
				url: config.protocol.concat(new URL(ctx.req.url).host.concat('/', name)),
				expirationTimestamp: 0
			});
		},
		(result) => {
			if (!result.success) {
				throw errorHandler.send(ErrorCode.validation);
			}
		}
	);
};
