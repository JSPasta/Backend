import { Elysia } from 'elysia';
import swagger from '@elysiajs/swagger';
import cors from '@elysiajs/cors';
import { IndexV1 } from '../endpoints/IndexV1.ts';
import { AccessV1 } from '../endpoints/AccessV1.ts';
import { AccessRawV1 } from '../endpoints/AccessRawV1.ts';
import { PublishV1 } from '../endpoints/PublishV1.ts';
import { RemoveV1 } from '../endpoints/RemoveV1.ts';
import { EditV2 } from '../endpoints/EditV2.ts';
import { ExistsV2 } from '../endpoints/ExistsV2.ts';
import { IndexV2 } from '../endpoints/IndexV2.ts';
import { PublishV2 } from '../endpoints/PublishV2.ts';
import { RemoveV2 } from '../endpoints/RemoveV2.ts';
import { AccessV2 } from '../endpoints/AccessV2.ts';
import { AccessRawV2 } from '../endpoints/AccessRawV2.ts';
import { type ServerOptions, ServerVersion } from '../types/Server.ts';
import { Error } from './Error.ts';
import * as env from 'env-var';
import { DocumentHandler } from './DocumentHandler.ts';
import { ErrorCode } from '../types/Error.ts';

export class Server {
	public static readonly config: Required<ServerOptions> = {
		tls: env.get('TLS').asBoolStrict() ?? false,
		domain: env.get('DOMAIN').default('localhost').asString(),
		port: env.get('PORT').default(4000).asPortNumber(),
		versions: [ServerVersion.v1, ServerVersion.v2],
		documents: {
			documentPath: 'documents/',
			maxLength: env.get('DOCUMENTS_MAXLENGTH').default(2000000).asIntPositive(),
			maxTime: env.get('DOCUMENTS_MAXTIME').default(86400).asIntPositive()
		},
		docs: {
			enabled: env.get('DOCS_ENABLED').asBoolStrict() ?? true,
			path: env.get('DOCS_PATH').default('/docs').asString(),
			playground: {
				tls: env.get('DOCS_PLAYGROUND_TLS').asBoolStrict() ?? true,
				domain: env.get('DOCS_PLAYGROUND_DOMAIN').default('jspaste.eu').asString(),
				port: env.get('DOCS_PLAYGROUND_PORT').default(443).asPortNumber()
			}
		},
		zlib: {
			level: 6
		}
	};

	private readonly elysia: Elysia = new Elysia();
	private readonly documentHandler: DocumentHandler = new DocumentHandler();

	public constructor() {
		this.initCORS();
		Server.config.docs.enabled && this.initDocs();
		this.initErrorHandler();
		this.initRoutes();

		this.elysia.listen(Server.config.port, ({ port }) =>
			console.info('Listening on port', port, `-> http://localhost:${port}`)
		);
	}

	public get getElysia(): Elysia {
		return this.elysia;
	}

	public get getDocumentHandler(): DocumentHandler {
		return this.documentHandler;
	}

	private initCORS(): void {
		this.elysia.use(
			cors({
				origin: true,
				methods: ['GET', 'POST', 'DELETE', 'HEAD', 'OPTIONS', 'PATCH']
			})
		);
	}

	private initDocs(): void {
		this.elysia.use(
			swagger({
				documentation: {
					servers: [
						{
							url: (Server.config.docs.playground.tls ? 'https://' : 'http://').concat(
								Server.config.docs.playground.domain,
								':',
								Server.config.docs.playground.port.toString()
							)
						}
					],
					info: {
						title: 'JSPaste documentation',
						version: Server.config.versions.map((version) => `v${version}`).join(', '),
						description:
							'The JSPaste API documentation. Note that you can use /documents instead of /api/vX/documents to use the latest API version by default.',
						license: {
							name: 'EUPL-1.2',
							url: 'https://raw.githubusercontent.com/JSPaste/JSP-Backend/stable/LICENSE'
						}
					}
				},
				swaggerOptions: {
					syntaxHighlight: { activate: true, theme: 'monokai' }
				},
				path: Server.config.docs.path,
				exclude: [Server.config.docs.path, Server.config.docs.path.concat('/json'), /^\/documents/]
			})
		);
	}

	private initErrorHandler(): void {
		this.elysia.onError(({ set, code, error }) => {
			switch (code) {
				case 'NOT_FOUND':
					return '';

				case 'VALIDATION':
					return Error.send(set, 400, Error.message[ErrorCode.validation]);

				case 'INTERNAL_SERVER_ERROR':
					console.error(error);
					return Error.send(set, 500, Error.message[ErrorCode.internalServerError]);

				case 'PARSE':
					return Error.send(set, 400, Error.message[ErrorCode.parseFailed]);

				default:
					console.error(error);
					return Error.send(set, 400, Error.message[ErrorCode.unknown]);
			}
		});
	}

	private initRoutes(): void {
		const apiVersions = Server.config.versions.toReversed();
		const routes = {
			[ServerVersion.v1]: {
				endpoints: [AccessRawV1, AccessV1, IndexV1, PublishV1, RemoveV1],
				prefixes: ['/api/v1/documents']
			},
			[ServerVersion.v2]: {
				endpoints: [AccessRawV2, AccessV2, EditV2, ExistsV2, IndexV2, PublishV2, RemoveV2],
				prefixes: ['/api/v2/documents', '/documents']
			}
		};

		for (const [i, version] of apiVersions.entries()) {
			routes[version].endpoints.forEach((Endpoint) => {
				const endpoint = new Endpoint(this);

				routes[version].prefixes.forEach(endpoint.register.bind(endpoint));
			});

			console.info(
				'Registered',
				routes[version].endpoints.length,
				'routes for version',
				version,
				i === 0 ? '(latest)' : ''
			);
		}
	}
}
