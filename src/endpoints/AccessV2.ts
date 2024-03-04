import { t } from 'elysia';
import { AbstractEndpoint } from '../classes/AbstractEndpoint.ts';
import { MessageHandler } from '../classes/MessageHandler.ts';
import { ServerEndpointVersion } from '../types/Server.ts';

export class AccessV2 extends AbstractEndpoint {
	protected override run(): void {
		this.server.getElysia.get(
			this.prefix.concat('/:key'),
			async ({ query, headers, params }) => {
				return this.server.getDocumentHandler
					.setVersion(ServerEndpointVersion.v2)
					.access({ key: params.key, password: headers.password || query.p });
			},
			{
				params: t.Object({
					key: t.String({
						description: 'The document key',
						examples: ['abc123']
					})
				}),
				headers: t.Object({
					password: t.Optional(
						t.String({
							description: 'The document password if aplicable',
							examples: ['abc123']
						})
					)
				}),
				query: t.Object({
					p: t.Optional(
						t.String({
							description:
								'The document password if aplicable, It is preferred to pass the password through headers, only use this method for support of web browsers.',
							examples: ['aaaaa-bbbbb-ccccc-ddddd']
						})
					)
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
							}),
							url: t.Optional(
								t.String({
									description: 'The URL for viewing the document on the web',
									examples: ['https://jspaste.eu/abc123']
								})
							),
							expirationTimestamp: t.Optional(
								t.Integer({
									description:
										'UNIX timestamp with the expiration date in milliseconds. Undefined if the document is permanent.',
									examples: [60, 0]
								})
							)
						},
						{
							description:
								'The document object, including the key, the data, the display URL and an expiration timestamp for the document'
						}
					),
					400: MessageHandler.schema,
					404: MessageHandler.schema
				},
				detail: { summary: 'Get document', tags: ['v2'] }
			}
		);
	}
}
