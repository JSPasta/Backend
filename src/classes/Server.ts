import { Elysia } from 'elysia';
import swagger from '@elysiajs/swagger';
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
import * as env from 'env-var';
import { DocumentHandler } from './DocumentHandler.ts';
import { type ServerConfig, ServerEndpointVersion } from '../types/Server.ts';
import { JSPError } from './JSPError.ts';
import { JSPErrorCode } from '../types/JSPError.ts';

export class Server {
	public static readonly config: Required<ServerConfig> = {
		tls: env.get('TLS').asBoolStrict() ?? false,
		domain: env.get('DOMAIN').default('localhost').asString(),
		port: env.get('PORT').default(4000).asPortNumber(),
		versions: [ServerEndpointVersion.v1, ServerEndpointVersion.v2],
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

	public static readonly hostname = (Server.config.tls ? 'https://' : 'http://').concat(Server.config.domain);
	public static readonly origin = Server.hostname.concat(':', Server.config.port.toString());
	public static readonly playgroundHostname = (Server.config.docs.playground.tls ? 'https://' : 'http://').concat(
		Server.config.docs.playground.domain
	);
	public static readonly playgroundOrigin = Server.playgroundHostname.concat(
		':',
		Server.config.docs.playground.port.toString()
	);

	private readonly elysia: Elysia = new Elysia();
	private readonly documentHandler: DocumentHandler = new DocumentHandler();

	public constructor() {
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

	private initDocs(): void {
		this.elysia.use(
			swagger({
				documentation: {
					servers: [
						{
							url: Server.origin
						}
					],
					info: {
						title: 'JSPaste documentation',
						version: Server.config.versions.map((version) => `V${version}`).join(', '),
						description: 'Note: The latest API version can be used with the "/documents" alias route.',
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
					return JSPError.send(set, 400, JSPError.message[JSPErrorCode.validation]);

				case 'INTERNAL_SERVER_ERROR':
					console.error(error);
					return JSPError.send(set, 500, JSPError.message[JSPErrorCode.internalServerError]);

				case 'PARSE':
					return JSPError.send(set, 400, JSPError.message[JSPErrorCode.parseFailed]);

				default:
					console.error(error);
					return JSPError.send(set, 400, JSPError.message[JSPErrorCode.unknown]);
			}
		});
	}

	private initRoutes(): void {
		const apiVersions = Server.config.versions.toReversed();
		const routes = {
			[ServerEndpointVersion.v1]: {
				endpoints: [AccessRawV1, AccessV1, IndexV1, PublishV1, RemoveV1],
				prefixes: ['/api/v1/documents']
			},
			[ServerEndpointVersion.v2]: {
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
