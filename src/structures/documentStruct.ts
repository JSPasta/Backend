// @generated by protobuf-ts 2.9.3
// @generated from protobuf file "documentStruct.proto" (syntax proto3)
// tslint:disable
//
//npx protoc --proto_path=".\src\structures" --ts_out=".\src\structures" "documentStruct.proto"
//
import type { BinaryWriteOptions } from '@protobuf-ts/runtime';
import type { IBinaryWriter } from '@protobuf-ts/runtime';
import { WireType } from '@protobuf-ts/runtime';
import type { BinaryReadOptions } from '@protobuf-ts/runtime';
import type { IBinaryReader } from '@protobuf-ts/runtime';
import { UnknownFieldHandler } from '@protobuf-ts/runtime';
import type { PartialMessage } from '@protobuf-ts/runtime';
import { reflectionMergePartial } from '@protobuf-ts/runtime';
import { MessageType } from '@protobuf-ts/runtime';
/**
 * @generated from protobuf message DocumentDataStruct
 */
export interface DocumentDataStruct {
	/**
	 * @generated from protobuf field: bytes raw_file_data = 1;
	 */
	rawFileData: Uint8Array;
	/**
	 * @generated from protobuf field: string secret = 2;
	 */
	secret: string;
	/**
	 * @generated from protobuf field: int64 deletion_time = 3;
	 */
	deletionTime: bigint;
	/**
	 * @generated from protobuf field: optional string password = 4;
	 */
	password?: string;
}
// @generated message type with reflection information, may provide speed optimized methods
class DocumentDataStruct$Type extends MessageType<DocumentDataStruct> {
	constructor() {
		super('DocumentDataStruct', [
			{
				no: 1,
				name: 'raw_file_data',
				kind: 'scalar',
				T: 12 /*ScalarType.BYTES*/,
			},
			{
				no: 2,
				name: 'secret',
				kind: 'scalar',
				T: 9 /*ScalarType.STRING*/,
			},
			{
				no: 3,
				name: 'deletion_time',
				kind: 'scalar',
				T: 3 /*ScalarType.INT64*/,
				L: 0 /*LongType.BIGINT*/,
			},
			{
				no: 4,
				name: 'password',
				kind: 'scalar',
				opt: true,
				T: 9 /*ScalarType.STRING*/,
			},
		]);
	}
	create(value?: PartialMessage<DocumentDataStruct>): DocumentDataStruct {
		const message = globalThis.Object.create(this.messagePrototype!);
		message.rawFileData = new Uint8Array(0);
		message.secret = '';
		message.deletionTime = 0n;
		if (value !== undefined)
			reflectionMergePartial<DocumentDataStruct>(this, message, value);
		return message;
	}
	internalBinaryRead(
		reader: IBinaryReader,
		length: number,
		options: BinaryReadOptions,
		target?: DocumentDataStruct,
	): DocumentDataStruct {
		let message = target ?? this.create(),
			end = reader.pos + length;
		while (reader.pos < end) {
			let [fieldNo, wireType] = reader.tag();
			switch (fieldNo) {
				case /* bytes raw_file_data */ 1:
					message.rawFileData = reader.bytes();
					break;
				case /* string secret */ 2:
					message.secret = reader.string();
					break;
				case /* int64 deletion_time */ 3:
					message.deletionTime = reader.int64().toBigInt();
					break;
				case /* optional string password */ 4:
					message.password = reader.string();
					break;
				default:
					let u = options.readUnknownField;
					if (u === 'throw')
						throw new globalThis.Error(
							`Unknown field ${fieldNo} (wire type ${wireType}) for ${this.typeName}`,
						);
					let d = reader.skip(wireType);
					if (u !== false)
						(u === true ? UnknownFieldHandler.onRead : u)(
							this.typeName,
							message,
							fieldNo,
							wireType,
							d,
						);
			}
		}
		return message;
	}
	internalBinaryWrite(
		message: DocumentDataStruct,
		writer: IBinaryWriter,
		options: BinaryWriteOptions,
	): IBinaryWriter {
		/* bytes raw_file_data = 1; */
		if (message.rawFileData.length)
			writer.tag(1, WireType.LengthDelimited).bytes(message.rawFileData);
		/* string secret = 2; */
		if (message.secret !== '')
			writer.tag(2, WireType.LengthDelimited).string(message.secret);
		/* int64 deletion_time = 3; */
		if (message.deletionTime !== 0n)
			writer.tag(3, WireType.Varint).int64(message.deletionTime);
		/* optional string password = 4; */
		if (message.password !== undefined)
			writer.tag(4, WireType.LengthDelimited).string(message.password);
		let u = options.writeUnknownFields;
		if (u !== false)
			(u == true ? UnknownFieldHandler.onWrite : u)(
				this.typeName,
				message,
				writer,
			);
		return writer;
	}
}
/**
 * @generated MessageType for protobuf message DocumentDataStruct
 */
export const DocumentDataStruct = new DocumentDataStruct$Type();
