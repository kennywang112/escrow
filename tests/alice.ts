import { AccountLayout, createInitializeAccountInstruction, TOKEN_PROGRAM_ID, createTransferInstruction } from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import BN = require("bn.js");
import {
  EscrowLayout,
  ESCROW_ACCOUNT_DATA_LAYOUT,
  getTerms,
  getTokenBalance,
  logError,
  writePublicKey,
} from "./utils";

describe("alice", () => {
    it("Uses the workspace to invoke the initialize instruction", async () => {
        const escrowProgramId = new PublicKey('2DkLffhYhMtvmiNHJoB1bjwDkZ2Behx5yKxeLhiEvgPB');
        const terms = getTerms();
        
        const aliceXTokenAccountPubkey = new PublicKey('F4rMWNogrJ7bsknYCKEkDiRbTS9voM7gKU2rcTDwzuwf');
        const aliceYTokenAccountPubkey = new PublicKey('Se9gzT3Ep3E452LPyYaWKYqcCvsAwtHhRQwQvmoXFxG');
        const XTokenMintPubkey = new PublicKey('D8J6gcTSLPwXS9h4afZvDEQr2qGxscVfUPnrfbHQxhzJ');
        const aliceKeypair1 = [9, 58, 29, 187, 97, 107, 204, 109, 195, 8, 212, 91, 117, 87, 209, 182, 225, 187, 153, 150, 124, 134, 11, 233, 42, 157, 175, 203, 125, 133, 181, 75, 209, 0, 41, 228, 153, 85, 147, 43, 19, 174, 186, 14, 207, 215, 140, 186, 103, 143, 155, 132, 140, 250, 108, 113, 164, 193, 206, 141, 121, 153, 56, 122];
        const aliceKeypair = Keypair.fromSecretKey(
            Uint8Array.from(aliceKeypair1)
        )

        const tempXTokenAccountKeypair = new Keypair();
        const connection = new Connection("http://localhost:8899", "confirmed");
        const createTempTokenAccountIx = SystemProgram.createAccount({
            programId: TOKEN_PROGRAM_ID,
            space: AccountLayout.span,
            lamports: await connection.getMinimumBalanceForRentExemption(
            AccountLayout.span
            ),
            fromPubkey: aliceKeypair.publicKey,
            newAccountPubkey: tempXTokenAccountKeypair.publicKey,
        });
        const initTempAccountIx = createInitializeAccountInstruction(
            TOKEN_PROGRAM_ID,
            XTokenMintPubkey,
            tempXTokenAccountKeypair.publicKey,
            aliceKeypair.publicKey
        );
        const transferXTokensToTempAccIx = createTransferInstruction(
            TOKEN_PROGRAM_ID,
            aliceXTokenAccountPubkey,
            tempXTokenAccountKeypair.publicKey,
            terms.bobExpectedAmount
            aliceKeypair.publicKey,
            [],
            terms.bobExpectedAmount
            
        );
        const escrowKeypair = new Keypair();
        const createEscrowAccountIx = SystemProgram.createAccount({
            space: ESCROW_ACCOUNT_DATA_LAYOUT.span,
            lamports: await connection.getMinimumBalanceForRentExemption(
            ESCROW_ACCOUNT_DATA_LAYOUT.span
            ),
            fromPubkey: aliceKeypair.publicKey,
            newAccountPubkey: escrowKeypair.publicKey,
            programId: escrowProgramId,
        });
        const initEscrowIx = new TransactionInstruction({
            programId: escrowProgramId,
            keys: [
            { pubkey: aliceKeypair.publicKey, isSigner: true, isWritable: false },
            {
                pubkey: tempXTokenAccountKeypair.publicKey,
                isSigner: false,
                isWritable: true,
            },
            {
                pubkey: aliceYTokenAccountPubkey,
                isSigner: false,
                isWritable: false,
            },
            { pubkey: escrowKeypair.publicKey, isSigner: false, isWritable: true },
            { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            ],
            data: Buffer.from(
            Uint8Array.of(0, ...new BN(terms.aliceExpectedAmount).toArray("le", 8))
            ),
        });

        const tx = new Transaction().add(
            createTempTokenAccountIx,
            initTempAccountIx,
            transferXTokensToTempAccIx,
            createEscrowAccountIx,
            initEscrowIx
        );
        console.log("Sending Alice's transaction...");
        await connection.sendTransaction(
            tx,
            [aliceKeypair, tempXTokenAccountKeypair, escrowKeypair],
            { skipPreflight: false, preflightCommitment: "confirmed" }
        );

        // sleep to allow time to update
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const escrowAccount = await connection.getAccountInfo(
            escrowKeypair.publicKey
        );

        if (escrowAccount === null || escrowAccount.data.length === 0) {
            logError("Escrow state account has not been initialized properly");
            process.exit(1);
        }

        const encodedEscrowState = escrowAccount.data;
        const decodedEscrowState = ESCROW_ACCOUNT_DATA_LAYOUT.decode(
            encodedEscrowState
        ) as EscrowLayout;

        if (!decodedEscrowState.isInitialized) {
            logError("Escrow state initialization flag has not been set");
            process.exit(1);
        } else if (
            !new PublicKey(decodedEscrowState.initializerPubkey).equals(
            aliceKeypair.publicKey
            )
        ) {
            logError(
            "InitializerPubkey has not been set correctly / not been set to Alice's public key"
            );
            process.exit(1);
        } else if (
            !new PublicKey(
            decodedEscrowState.initializerReceivingTokenAccountPubkey
            ).equals(aliceYTokenAccountPubkey)
        ) {
            logError(
            "initializerReceivingTokenAccountPubkey has not been set correctly / not been set to Alice's Y public key"
            );
            process.exit(1);
        } else if (
            !new PublicKey(decodedEscrowState.initializerTempTokenAccountPubkey).equals(
            tempXTokenAccountKeypair.publicKey
            )
        ) {
            logError(
            "initializerTempTokenAccountPubkey has not been set correctly / not been set to temp X token account public key"
            );
            process.exit(1);
        }
        writePublicKey(escrowKeypair.publicKey, "escrow");
        console.table([
            {
            "Alice Token Account X": await getTokenBalance(
                aliceXTokenAccountPubkey,
                connection
            ),
            "Alice Token Account Y": await getTokenBalance(
                aliceYTokenAccountPubkey,
                connection
            ),
            "Temporary Token Account X": await getTokenBalance(
                tempXTokenAccountKeypair.publicKey,
                connection
            ),
            },
        ]);
    });
})