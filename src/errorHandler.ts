import type { ResponseConfig } from '@asteasolutions/zod-to-openapi/dist/openapi-registry';
import { z } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import type { StatusCode } from 'hono/utils/http-status';
import { ErrorCode, type Schema } from './types/ErrorHandler.ts';

const map: Record<ErrorCode, Schema> = {
	[ErrorCode.unknown]: {
		httpCode: 500,
		type: 'generic',
		message:
			'An unknown error occurred. This may be due to an unexpected condition in the server. If it happens again, please report it here: https://github.com/jspaste/backend/issues/new/choose'
	},
	[ErrorCode.notFound]: {
		httpCode: 404,
		type: 'generic',
		message: 'The requested resource does not exist.'
	},
	[ErrorCode.validation]: {
		httpCode: 400,
		type: 'generic',
		message:
			'Validation of the request data failed. Check the entered data according to our documentation: https://jspaste.eu/docs'
	},
	[ErrorCode.crash]: {
		httpCode: 500,
		type: 'generic',
		message:
			'An internal server error occurred. This may be due to an unhandled exception. If it happens again, please report it here: https://github.com/jspaste/backend/issues/new/choose'
	},
	[ErrorCode.parse]: {
		httpCode: 400,
		type: 'generic',
		message:
			'The request could not be parsed. This may be due to a malformed input or an unsupported data format. Check the entered data and try again.'
	},
	[ErrorCode.dummy]: {
		httpCode: 200,
		type: 'generic',
		message: 'This is a dummy error.'
	},
	[ErrorCode.documentNotFound]: {
		httpCode: 404,
		type: 'document',
		message: 'The requested document does not exist. Check the document name and try again.'
	},
	[ErrorCode.documentPasswordNeeded]: {
		httpCode: 401,
		type: 'document',
		message: 'This document is protected. Provide the document password and try again.'
	},
	[ErrorCode.documentInvalidPassword]: {
		httpCode: 403,
		type: 'document',
		message: 'The credentials provided for the document are invalid.'
	},
	[ErrorCode.documentInvalidPasswordLength]: {
		httpCode: 400,
		type: 'document',
		message: 'The password length provided for the document is invalid.'
	},
	[ErrorCode.documentInvalidSize]: {
		httpCode: 413,
		type: 'document',
		message: 'The body size provided for the document is too large.'
	},
	[ErrorCode.documentInvalidSecret]: {
		httpCode: 403,
		type: 'document',
		message: 'The credentials provided for the document are invalid.'
	},
	[ErrorCode.documentInvalidSecretLength]: {
		httpCode: 400,
		type: 'document',
		message: 'The secret length provided for the document is invalid.'
	},
	[ErrorCode.documentInvalidNameLength]: {
		httpCode: 400,
		type: 'document',
		message: 'The name length provided for the document is out of range.'
	},
	[ErrorCode.documentNameAlreadyExists]: {
		httpCode: 400,
		type: 'document',
		message: 'The name provided for the document already exists. Use another one and try again.'
	},
	[ErrorCode.documentInvalidName]: {
		httpCode: 400,
		type: 'document',
		message: 'The name provided for the document is invalid. Use another one and try again.'
	},
	[ErrorCode.documentCorrupted]: {
		httpCode: 500,
		type: 'document',
		message: 'The document is corrupted. It may have been tampered with or uses an unsupported format.'
	}
} as const;

export const errorHandler = {
	get: (code: ErrorCode) => {
		const { type, message } = map[code];

		return { type, code, message };
	},

	send: (code: ErrorCode) => {
		const { httpCode, type, message } = map[code];

		throw new HTTPException(httpCode as StatusCode, {
			res: new Response(JSON.stringify({ type, code, message }), {
				status: httpCode,
				headers: {
					'Content-Type': 'application/json'
				}
			})
		});
	}
} as const;

export const schema: ResponseConfig = {
	content: {
		'application/json': {
			schema: z.object({
				type: z.string().openapi({
					description: 'The message type',
					example: errorHandler.get(ErrorCode.dummy).type
				}),
				code: z.number().openapi({
					description: 'The message code',
					example: errorHandler.get(ErrorCode.dummy).code
				}),
				message: z.string().openapi({
					description: 'The message description',
					example: errorHandler.get(ErrorCode.dummy).message
				})
			})
		}
	},
	description: 'Generic error object'
} as const;
