type DocumentV1 = {
	data: Uint8Array;
	header: {
		name: string;
		secretHash: string;
		passwordHash: string | null;
	};
	version: 1;
};

export type { DocumentV1 };
