import type { APIVersions } from '../utils/constants';

export interface ServerOptions {
	/** The hostname for swagger */
	docsHostname: string;

	/** The port to listen on */
	port: string | number;

	/** Accessible API versions */
	versions: APIVersions[];
}
