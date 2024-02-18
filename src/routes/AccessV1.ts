import { AbstractEndpoint } from '../classes/AbstractEndpoint.ts';
import { t } from 'elysia';
import { ServerVersion } from '../types/Server.ts';
import { JSPError } from '../classes/JSPError.ts';
import type { Server } from '../classes/Server.ts';

export class AccessV1 extends AbstractEndpoint {
	public constructor(server: Server) {
		super(server);
	}

	public override register(prefix: string): void {
		const hook = {
			params: t.Object({
				key: t.String({
					description: 'The document key',
					examples: ['abc123']
				})
			}),
			response: {
				200: t.Object(
					{
						key: t.String({
							description: 'The key of the document',
							examples: ['abc123']
						}),
						data: t.String({
							description: 'The document',
							examples: ['Hello world']
						})
					},
					{ description: 'The document object' }
				),
				400: JSPError.schema,
				404: JSPError.schema
			},
			detail: { summary: 'Get document', tags: ['v1'] }
		};

		this.server.getElysia.get(
			prefix.concat('/:key'),
			async ({ set, params }) => {
				this.server.getDocumentHandler.setContext = set;
				return this.server.getDocumentHandler.access({ key: params.key }, ServerVersion.v1);
			},
			hook
		);
	}
}
