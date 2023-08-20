use solana_program::{
    program_pack::{IsInitialized, Pack, Sealed},
    pubkey::Pubkey,
};
use solana_program::sysvar::slot_history::ProgramError;

use arrayref::{array_mut_ref, array_ref, array_refs, mut_array_refs};
pub struct Escrow {
    // determine whether a given escrow account is already in use
    pub is_initialized: bool,
    // Alice's account
    pub initializer_pubkey: Pubkey,

    // save it so that escrow can send tokens from the account at 
    // temp_token_account_publicky to Bob's account
    pub temp_token_account_pubkey: Pubkey,
    // when bob takes the trade , his tokens will sent to this account
    pub initializer_token_to_receive_account_pubkey: Pubkey,
    // check bob sends enough token
    pub expected_amount: u64,
}

// same as sized trait
impl Sealed for Escrow {}

impl IsInitialized for Escrow {

    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

impl Pack for Escrow {

    const LEN: usize = 105;

    // turns an array of u8 into an instance of Escrow struct defined above
    fn unpack_from_slice(src: &[u8]) -> Result<Self, ProgramError> {
        let src = array_ref![src, 0, Escrow::LEN];
        let (
            is_initialized,
            initializer_pubkey,
            temp_token_account_pubkey,
            initializer_token_to_receive_account_pubkey,
            expected_amount,
        ) = array_refs![src, 1, 32, 32, 32, 8];
        let is_initialized = match is_initialized {
            [0] => false,
            [1] => true,
            _ => return Err(ProgramError::InvalidAccountData),
        };

        Ok(Escrow {
            is_initialized,
            initializer_pubkey: Pubkey::new_from_array(*initializer_pubkey),
            temp_token_account_pubkey: Pubkey::new_from_array(*temp_token_account_pubkey),
            initializer_token_to_receive_account_pubkey: Pubkey::new_from_array(*initializer_token_to_receive_account_pubkey),
            expected_amount: u64::from_le_bytes(*expected_amount),
        })
    }
    
    // same as unpack but vice versa
    fn pack_into_slice(&self, dst: &mut [u8]) {
        let dst = array_mut_ref![dst, 0, Escrow::LEN];
        let (
            is_initialized_dst,
            initializer_pubkey_dst,
            temp_token_account_pubkey_dst,
            initializer_token_to_receive_account_pubkey_dst,
            expected_amount_dst,
        ) = mut_array_refs![dst, 1, 32, 32, 32, 8];

        let Escrow {
            is_initialized,
            initializer_pubkey,
            temp_token_account_pubkey,
            initializer_token_to_receive_account_pubkey,
            expected_amount,
        } = self;

        is_initialized_dst[0] = *is_initialized as u8;
        initializer_pubkey_dst.copy_from_slice(initializer_pubkey.as_ref());
        temp_token_account_pubkey_dst.copy_from_slice(temp_token_account_pubkey.as_ref());
        initializer_token_to_receive_account_pubkey_dst.copy_from_slice(initializer_token_to_receive_account_pubkey.as_ref());
        *expected_amount_dst = expected_amount.to_le_bytes();
    }
}