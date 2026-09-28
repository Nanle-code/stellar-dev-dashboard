# Soroban Contract Best Practices

This guide covers best practices for developing secure, efficient, and maintainable Soroban smart contracts.

## Code Structure

### 1. Module Organization

```rust
// lib.rs
mod contract;
mod errors;
mod events;
mod storage;
mod utils;

pub use contract::*;
```

```rust
// contract.rs
#[contract]
pub struct MyContract;

#[contractimpl]
impl MyContract {
    pub fn initialize(env: Env, admin: Address) {
        storage::set_admin(&env, &admin);
    }
}
```

```rust
// errors.rs
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    Unauthorized = 1,
    AlreadyInitialized = 2,
    InvalidAmount = 3,
    InsufficientBalance = 4,
}

impl Error {
    pub fn panic(self, env: &Env) {
        env.panic_with_error(self);
    }
}
```

### 2. Consistent Naming

- Use `snake_case` for functions and variables
- Use `PascalCase` for types and contracts
- Prefix private helpers with `_` (e.g., `_get_balance`)
- Use descriptive names (e.g., `calculate_total_fee` not `calc_fee`)

## Storage Best Practices

### 1. Key Naming Conventions

```rust
// Use consistent naming for storage keys
fn get_balance_key(account: &Address, env: &Env) -> Val {
    format!("balance:{}", account.to_string()).into_val(env)
}

fn get_total_key(env: &Env) -> Val {
    "total".into_val(env)
}

// Better: Use enums for keys
enum StorageKey {
    Balance(Address),
    Total,
}

impl StorageKey {
    fn to_val(&self, env: &Env) -> Val {
        match self {
            StorageKey::Balance(addr) => {
                format!("balance:{}", addr.to_string()).into_val(env)
            }
            StorageKey::Total => "total".into_val(env),
        }
    }
}
```

### 2. Storage Lifetime Management

```rust
// Use temporary storage for intermediate calculations
pub fn calculate_amount(env: Env, input: u128) -> u128 {
    // Temporary storage (cleared after function call)
    let temp_storage = env.storage().temporary();
    
    let key = "temp_calc".into_val(&env);
    temp_storage.set(&key, &input);
    
    let result = temp_storage.get::<_, u128>(&key).unwrap_or(0);
    temp_storage.remove(&key);
    
    result
}

// Use persistent storage for contract state
pub fn store_permanent_data(env: Env, data: u128) {
    let storage = env.storage().persistent();
    storage.set(&"data".into_val(&env), &data);
}

// Use instance storage for frequently accessed data
pub fn get_owner(env: Env) -> Address {
    let storage = env.storage().instance();
    storage.get(&"owner".into_val(&env)).unwrap()
}
```

## Error Handling

### 1. Result Pattern

```rust
pub fn transfer(
    env: Env,
    from: Address,
    to: Address,
    amount: u128,
) -> Result<bool, Error> {
    from.require_auth();

    if amount == 0 {
        return Err(Error::InvalidAmount);
    }

    let balance = get_balance(&env, &from)?;
    if balance < amount {
        return Err(Error::InsufficientBalance);
    }

    update_balance(&env, &from, balance - amount);
    update_balance(&env, &to, get_balance(&env, &to)? + amount);

    Ok(true)
}

fn get_balance(env: &Env, account: &Address) -> Result<u128, Error> {
    let storage = env.storage().persistent();
    let key = format!("balance:{}", account.to_string()).into_val(env);
    
    Ok(storage.get(&key).unwrap_or(0))
}
```

### 2. Error Messages

```rust
// Use descriptive error codes and messages
pub fn validate_input(amount: u128) -> Result<(), Error> {
    if amount == 0 {
        return Err(Error::InvalidAmount); // "Amount must be greater than 0"
    }
    
    if amount > u128::MAX / 2 {
        return Err(Error::AmountOverflow); // "Amount would cause overflow"
    }
    
    Ok(())
}
```

## Authorization

### 1. Single Signer

```rust
pub fn admin_operation(env: Env, admin: Address) {
    // Require authorization from the admin
    admin.require_auth();
    
    // Perform privileged operation
}
```

### 2. Multi-Signature

```rust
pub fn multisig_operation(
    env: Env,
    signers: Vec<Address>,
) -> Result<(), Error> {
    if signers.len() != REQUIRED_SIGNATURES {
        return Err(Error::InvalidSignerCount);
    }

    for signer in signers {
        signer.require_auth();
    }

    // Perform operation
    Ok(())
}

const REQUIRED_SIGNATURES: usize = 3;
```

### 3. Contract Authorization

```rust
pub fn call_other_contract(env: Env, contract: Address) -> Result<(), Error> {
    // Authorize this contract to make cross-contract calls
    contract.require_auth();
    
    // Make cross-contract call
    Ok(())
}
```

## Testing

### 1. Unit Test Structure

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::Env;

    fn setup() -> (Env, Address, Address) {
        let env = Env::default();
        let admin = Address::random(&env);
        let user = Address::random(&env);
        
        (env, admin, user)
    }

    #[test]
    fn test_basic_operation() {
        let (env, admin, _user) = setup();
        
        MyContract::initialize(env.clone(), admin);
        
        // Assert state
        let owner = storage::get_admin(&env);
        assert_eq!(owner, admin);
    }

    #[test]
    fn test_unauthorized_operation() {
        let (env, admin, user) = setup();
        
        MyContract::initialize(env.clone(), admin);
        
        // This should fail - user is not authorized
        let result = MyContract::admin_operation(env, user);
        
        assert!(result.is_err());
    }

    #[test]
    #[should_panic]
    fn test_panics_on_invalid_input() {
        let env = Env::default();
        
        MyContract::set_amount(env, 0); // Should panic
    }
}
```

### 2. Property-Based Testing

```rust
#[cfg(test)]
mod property_tests {
    use super::*;

    #[test]
    fn test_transfer_preserves_total() {
        let env = Env::default();
        let initial_total = 1000u128;
        
        // Test multiple random amounts
        for amount in [1, 100, 500, 999].iter() {
            let account1 = Address::random(&env);
            let account2 = Address::random(&env);
            
            transfer(&env, &account1, &account2, *amount).unwrap();
            
            // Total should remain constant
            assert_eq!(get_total(&env), initial_total);
        }
    }
}
```

## Gas Optimization

### 1. Minimize Storage Operations

```rust
// Inefficient - multiple reads and writes
pub fn bad_update(env: Env, addr: Address, amount: u128) {
    let storage = env.storage().persistent();
    
    let balance = storage.get::<_, u128>(&key(&addr, &env)).unwrap_or(0);
    let new_balance = balance + amount;
    storage.set(&key(&addr, &env), &new_balance);
    storage.set(&"total".into_val(&env), &(get_total(&env, &storage) + amount));
}

// Efficient - batch operations
pub fn good_update(env: Env, addr: Address, amount: u128) {
    let storage = env.storage().persistent();
    let key = key(&addr, &env);
    
    let balance = storage.get(&key).unwrap_or(0);
    storage.set(&key, &(balance + amount));
}
```

### 2. Early Exit on Errors

```rust
// Inefficient - continues processing after error
pub fn bad_processing(env: Env) {
    if invalid_condition(&env) {
        // Still performs operations below
    }
    
    perform_operation(&env);
}

// Efficient - exit early
pub fn good_processing(env: Env) -> Result<(), Error> {
    if invalid_condition(&env) {
        return Err(Error::InvalidCondition);
    }
    
    perform_operation(&env)?;
    Ok(())
}
```

## Security

### 1. Reentrancy Prevention

```rust
pub fn transfer(env: Env, to: Address, amount: u128) -> Result<(), Error> {
    // Mark operation as in-progress before external call
    set_locked(&env, true);
    
    defer_cleanup(|| set_locked(&env, false));
    
    // External call
    invoke_contract(&env, to, "on_receive".into(), amount)?;
    
    Ok(())
}

fn is_locked(env: &Env) -> bool {
    env.storage().persistent()
        .get(&"locked".into_val(env))
        .unwrap_or(false)
}

fn set_locked(env: &Env, locked: bool) {
    env.storage().persistent()
        .set(&"locked".into_val(env), &locked);
}
```

### 2. Overflow Protection

```rust
pub fn safe_add(a: u128, b: u128) -> Result<u128, Error> {
    a.checked_add(b)
        .ok_or(Error::Overflow)
}

pub fn safe_multiply(a: u128, b: u128) -> Result<u128, Error> {
    a.checked_mul(b)
        .ok_or(Error::Overflow)
}

#[test]
fn test_overflow_protection() {
    assert!(safe_add(u128::MAX, 1).is_err());
    assert!(safe_multiply(u128::MAX, 2).is_err());
}
```

### 3. Input Validation

```rust
pub fn transfer(env: Env, to: Address, amount: u128) -> Result<(), Error> {
    // Validate inputs
    if amount == 0 {
        return Err(Error::ZeroAmount);
    }
    
    // Validate address is not contract
    if to.to_string() == env.current_contract_address().to_string() {
        return Err(Error::CannotTransferToSelf);
    }
    
    // Perform operation
    Ok(())
}
```

## Documentation

### 1. Function Documentation

```rust
/// Transfers tokens from one account to another.
///
/// # Arguments
///
/// * `env` - The contract environment
/// * `from` - The sender's address (must be authorized)
/// * `to` - The recipient's address
/// * `amount` - The amount to transfer (must be > 0)
///
/// # Returns
///
/// Returns `Ok(true)` if transfer is successful, `Err` if validation fails
///
/// # Errors
///
/// * `InvalidAmount` - If amount is zero
/// * `InsufficientBalance` - If from account has insufficient balance
/// * `Unauthorized` - If from address is not authorized
///
/// # Example
///
/// ```
/// let result = transfer(env, sender, recipient, 1000);
/// assert!(result.is_ok());
/// ```
pub fn transfer(env: Env, from: Address, to: Address, amount: u128) -> Result<bool, Error> {
    // Implementation
}
```

### 2. Event Documentation

```rust
/// Emitted when a transfer occurs
///
/// # Fields
/// - from: The sender's address
/// - to: The recipient's address
/// - amount: The amount transferred
pub fn emit_transfer(env: &Env, from: &Address, to: &Address, amount: u128) {
    env.events().publish(("transfer", from.clone(), to.clone()), amount);
}
```

## Common Pitfalls

### 1. Forgetting `require_auth()`

```rust
// WRONG - Missing require_auth()
pub fn transfer(env: Env, from: Address, to: Address, amount: u128) {
    // This will fail authorization
    env.storage().persistent()
        .set(&key(&from, &env), &amount);
}

// CORRECT
pub fn transfer(env: Env, from: Address, to: Address, amount: u128) {
    from.require_auth();
    
    env.storage().persistent()
        .set(&key(&from, &env), &amount);
}
```

### 2. Type Mismatches in Storage

```rust
// WRONG - Type mismatch
let value: u32 = storage.get(&key).unwrap_or(0u128 as u32);

// CORRECT - Consistent types
let value: u128 = storage.get(&key).unwrap_or(0u128);
```

### 3. Unchecked Arithmetic

```rust
// WRONG - May overflow
pub fn calculate(a: u128, b: u128) -> u128 {
    a + b  // Could panic if overflow
}

// CORRECT - Checked arithmetic
pub fn calculate(a: u128, b: u128) -> Result<u128, Error> {
    a.checked_add(b).ok_or(Error::Overflow)
}
```

## Checklist

Before deploying a contract:

- [ ] All functions have `require_auth()` where needed
- [ ] Error handling is comprehensive
- [ ] Storage keys are consistent
- [ ] Tests cover happy paths and error cases
- [ ] No overflow/underflow vulnerabilities
- [ ] Code is documented
- [ ] Performance is optimized
- [ ] Security review completed
- [ ] Testnet deployment successful
- [ ] Upgrade path planned

---

## Resources

- [Soroban Documentation](https://developers.stellar.org/docs/build/smart-contracts)
- [Rust Best Practices](https://doc.rust-lang.org/1.0.0/style/)
- [Contract Security Audit Checklist](https://github.com/stellar/rs-soroban-sdk)
