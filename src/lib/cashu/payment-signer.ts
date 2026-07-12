import type { Proof } from '@cashu/cashu-ts';

export type CashuPaymentSigningPurpose = 'release' | 'reclaim';
export const CASHU_PAYMENT_SIGNER_PROTOCOL = 'manual-minibits-v1' as const;

export interface CashuP2PKSigningRequest {
	mintUrl: string;
	proofs: readonly Proof[];
	purpose: CashuPaymentSigningPurpose;
}

/** Wallet-scoped Cashu signer. Implementations never expose secret key material. */
export interface CashuPaymentSigner {
	readonly protocol: typeof CASHU_PAYMENT_SIGNER_PROTOCOL;
	getPublicKey(): Promise<string>;
	signP2PKProofs(request: CashuP2PKSigningRequest): Promise<Proof[]>;
}

export class PaymentSigningError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'PaymentSigningError';
	}
}

function sameProof(source: Proof, signed: Proof): boolean {
	return (
		source.id === signed.id &&
		source.amount === signed.amount &&
		source.secret === signed.secret &&
		source.C === signed.C &&
		source.p2pk_e === signed.p2pk_e &&
		JSON.stringify(source.dleq) === JSON.stringify(signed.dleq)
	);
}

/** Request witnesses while ensuring the signer only adds witness data to exact source proofs. */
export async function requestP2PKSignatures(
	signer: CashuPaymentSigner,
	request: CashuP2PKSigningRequest
): Promise<Proof[]> {
	if (signer.protocol !== CASHU_PAYMENT_SIGNER_PROTOCOL) {
		throw new PaymentSigningError('Unsupported Cashu payment signer protocol');
	}
	const sourceProofs = request.proofs.map((proof) => structuredClone(proof));
	const signedProofs = await signer.signP2PKProofs({ ...request, proofs: sourceProofs });

	if (signedProofs.length !== sourceProofs.length) {
		throw new PaymentSigningError('Payment signer returned a different number of proofs');
	}

	for (let index = 0; index < sourceProofs.length; index++) {
		if (!sameProof(sourceProofs[index], signedProofs[index])) {
			throw new PaymentSigningError('Payment signer altered or reordered source proofs');
		}
		if (signedProofs[index].witness === undefined) {
			throw new PaymentSigningError('Payment signer returned a proof without a witness');
		}
	}

	return signedProofs;
}
