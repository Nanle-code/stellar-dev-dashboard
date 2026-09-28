# Soroban Smart Contract Development Course

## Overview

This comprehensive course covers smart contract development using Soroban, Stellar's smart contracts platform. It includes step-by-step tutorials, example contracts, testing best practices, debugging guides, and performance optimization tips.

## Table of Contents

1. [Fundamentals](#fundamentals)
2. [Getting Started](#getting-started)
3. [Basic Contracts](#basic-contracts)
4. [Advanced Patterns](#advanced-patterns)
5. [Testing](#testing)
6. [Debugging](#debugging)
7. [Performance Optimization](#performance-optimization)
8. [Common Patterns](#common-patterns)
9. [Security Best Practices](#security-best-practices)
10. [Deployment](#deployment)

---

## Fundamentals

### What is Soroban?

Soroban is Stellar's smart contracts platform that enables developers to write contracts in Rust that run on the Stellar blockchain. Key characteristics:

- **Language**: WebAssembly (Rust compiled)
- **Performance**: Fast execution with low fees
- **Integration**: Native integration with Stellar assets and operations
- **Safety**: Type-safe Rust ensures memory safety

### Key Concepts

#### Contract

A contract is a Rust program compiled to WASM that executes deterministically on the Stellar network.

#### Data Types

Soroban contracts can work with:
- Native Stellar types (Accounts, Assets)
- Scalar types (u32, i128, Bytes, String)
- Complex types (Vec, Map, Struct, Enum)
- Custom types

#### Contract State

Contracts can store persistent data on-chain:

```rust
// Define contract state
#[contract]
pub struct MyContract;

#[contractimpl]
impl MyContract {
    pub fn set_count(env: Env, count: u32) {
        env.storage().persistent().set(&"count".into_val(&env), &count);
    }

    pub fn get_count(env: Env) -> u32 {
        env.storage()
            .persistent()
            .get(&"count".into_val(&env))
            .unwrap_or(0)
    }
}
```

---

## Getting Started

### Prerequisites

- Rust 1.74+ installed
- Stellar CLI installed
- Basic Rust knowledge

### Installation

```bash
# Install Soroban CLI
cargo install stellar-cli --features soroban

# Verify installation
stellar --version
soroban --version
```

### Project Setup

```bash
# Create a new Soroban project
cargo new --lib my_contract
cd my_contract

# Add Soroban dependencies
cargo add soroban-sdk
cargo add soroban-auth
```

### Configure `Cargo.toml`

```toml
[lib]
crate-type = ["cdylib"]

[dependencies]
soroban-sdk = { version = "=21.0" }
soroban-auth = { version = "=21.0" }

[dev-dependencies]
soroban-ledger-snapshot-soroban-test = "=21.0"
```

---

## Basic Contracts

### 1. Counter Contract

A simple contract that stores and increments a counter:

```rust
use soroban_sdk::{contract, contractimpl, Env};

#[contract]
pub struct CounterContract;

#[contractimpl]
impl CounterContract {
    /// Initialize counter to 0
    pub fn init(env: Env) {
        let storage = env.storage().persistent();
        storage.set(&"counter".into_val(&env), &0_u32);
    }

    /// Increment counter
    pub fn increment(env: Env) -> u32 {
        let storage = env.storage().persistent();
        let key = "counter".into_val(&env);
        
        let current: u32 = storage.get(&key).unwrap_or(0);
        let new_value = current + 1;
        
        storage.set(&key, &new_value);
        new_value
    }

    /// Get current counter value
    pub fn get_count(env: Env) -> u32 {
        let storage = env.storage().persistent();
        storage.get(&"counter".into_val(&env)).unwrap_or(0)
    }
}
```

### 2. Token Transfer Contract

A contract managing token transfers:

```rust
use soroban_sdk::{contract, contractimpl, Address, Env, Symbol};

#[contract]
pub struct TokenTransfer;

#[contractimpl]
impl TokenTransfer {
    /// Transfer tokens between accounts
    pub fn transfer(
        env: Env,
        from: Address,
        to: Address,
        amount: u128,
    ) -> Result<(), Symbol> {
        // Verify sender authorization
        from.require_auth();

        // Get token contract
        let token = get_token_contract(&env);

        // Execute transfer
        invoke_stellar_contract(
            &env,
            token,
            Symbol::short("transfer"),
            (from, to, amount),
        )
    }
}

fn get_token_contract(env: &Env) -> Address {
    env.storage()
        .persistent()
        .get(&"token".into_val(env))
        .unwrap()
}

fn invoke_stellar_contract(
    env: &Env,
    contract: Address,
    fn_name: Symbol,
    args: impl IntoVal<Env, soroban_sdk::Val>,
) {
    // Implementation for calling other contracts
}
```

### 3. Simple Marketplace Contract

A basic marketplace for buying and selling items:

```rust
use soroban_sdk::{contract, contractimpl, Address, Env, Vec, Symbol};

#[contract]
pub struct Marketplace;

#[contractimpl]
impl Marketplace {
    /// List an item for sale
    pub fn list_item(
        env: Env,
        seller: Address,
        item_id: u32,
        price: u128,
    ) {
        seller.require_auth();

        let storage = env.storage().persistent();
        let key = format!("item:{}", item_id).into_val(&env);
        
        storage.set(&key, &(seller, price));
    }

    /// Purchase an item
    pub fn purchase_item(
        env: Env,
        buyer: Address,
        item_id: u32,
        payment_token: Address,
    ) -> Result<(), Symbol> {
        buyer.require_auth();

        let storage = env.storage().persistent();
        let item_key = format!("item:{}", item_id).into_val(&env);

        let (seller, price): (Address, u128) = storage.get(&item_key)?;

        // Transfer payment from buyer to seller
        // (implementation details)

        // Mark item as sold
        storage.remove(&item_key);

        Ok(())
    }
}
```

---

## Advanced Patterns

### 1. Trusted Entity Pattern

Contracts with a designated admin:

```rust
#[contractimpl]
impl AdminContract {
    pub fn set_admin(env: Env, new_admin: Address) {
        // Verify current admin
        let admin = get_admin(&env);
        admin.require_auth();

        // Set new admin
        env.storage()
            .persistent()
            .set(&"admin".into_val(&env), &new_admin);
    }

    pub fn protected_operation(env: Env) {
        let admin = get_admin(&env);
        admin.require_auth();
        
        // Perform protected operation
    }
}

fn get_admin(env: &Env) -> Address {
    env.storage()
        .persistent()
        .get(&"admin".into_val(env))
        .unwrap()
}
```

### 2. Multi-Signature Pattern

Contracts requiring multiple signers:

```rust
#[contractimpl]
impl MultiSig {
    pub fn propose_action(env: Env, action_data: Bytes) -> u32 {
        let storage = env.storage().persistent();
        
        let proposal_id = get_next_proposal_id(&env);
        let proposal_key = format!("proposal:{}", proposal_id).into_val(&env);

        storage.set(&proposal_key, &action_data);
        proposal_id
    }

    pub fn approve(env: Env, signer: Address, proposal_id: u32) {
        signer.require_auth();

        let storage = env.storage().persistent();
        let approval_key = format!("approval:{}:{}", proposal_id, signer.to_string())
            .into_val(&env);

        storage.set(&approval_key, &true);
        
        // Check if threshold reached
        if get_approval_count(&env, proposal_id) >= THRESHOLD {
            execute_proposal(&env, proposal_id);
        }
    }
}

const THRESHOLD: u32 = 2;

fn get_next_proposal_id(env: &Env) -> u32 {
    let storage = env.storage().persistent();
    let counter_key = "proposal_counter".into_val(env);
    
    let current: u32 = storage.get(&counter_key).unwrap_or(0);
    storage.set(&counter_key, &(current + 1));
    
    current + 1
}

fn get_approval_count(env: &Env, proposal_id: u32) -> u32 {
    let storage = env.storage().persistent();
    
    // Count approvals (simplified)
    let signers = vec!["signer1", "signer2"]; // Get from storage
    
    signers.iter()
        .filter(|signer| {
            let approval_key = format!("approval:{}:{}", proposal_id, signer)
                .into_val(env);
            storage.get::<_, bool>(&approval_key).unwrap_or(false)
        })
        .count() as u32
}

fn execute_proposal(env: &Env, _proposal_id: u32) {
    // Execute the approved proposal
}
```

### 3. Pausable Contract Pattern

Allow contract to be paused in emergencies:

```rust
#[contractimpl]
impl PausableContract {
    pub fn pause(env: Env) {
        let admin = get_admin(&env);
        admin.require_auth();
        
        env.storage()
            .persistent()
            .set(&"paused".into_val(&env), &true);
    }

    pub fn unpause(env: Env) {
        let admin = get_admin(&env);
        admin.require_auth();
        
        env.storage()
            .persistent()
            .set(&"paused".into_val(&env), &false);
    }

    pub fn transfer(env: Env, to: Address, amount: u128) {
        // Check if paused
        let is_paused: bool = env.storage()
            .persistent()
            .get(&"paused".into_val(&env))
            .unwrap_or(false);

        if is_paused {
            env.panic_with_error(Error::ContractPaused);
        }

        // Perform transfer
    }
}

enum Error {
    ContractPaused,
}
```

---

## Testing

### Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn test_counter_increment() {
        let env = Env::default();
        
        // Initialize counter
        CounterContract::init(env.clone());
        
        // Increment counter
        let result = CounterContract::increment(env.clone());
        assert_eq!(result, 1);
        
        // Verify state
        let count = CounterContract::get_count(env);
        assert_eq!(count, 1);
    }

    #[test]
    fn test_counter_multiple_increments() {
        let env = Env::default();
        
        CounterContract::init(env.clone());
        
        for i in 1..=5 {
            let result = CounterContract::increment(env.clone());
            assert_eq!(result, i);
        }
        
        let final_count = CounterContract::get_count(env);
        assert_eq!(final_count, 5);
    }

    #[test]
    fn test_initial_count_is_zero() {
        let env = Env::default();
        
        let count = CounterContract::get_count(env);
        assert_eq!(count, 0);
    }
}
```

### Integration Tests

```rust
#[cfg(test)]
mod integration_tests {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn test_marketplace_workflow() {
        let env = Env::default();
        
        let seller = Address::random(&env);
        let buyer = Address::random(&env);
        
        // List item
        Marketplace::list_item(env.clone(), seller.clone(), 1, 100);
        
        // Purchase item
        let result = Marketplace::purchase_item(
            env.clone(),
            buyer.clone(),
            1,
            Address::random(&env),
        );
        
        assert!(result.is_ok());
    }
}
```

### Test Best Practices

1. **Isolate Tests**: Each test should be independent
2. **Use Fixtures**: Create reusable test data
3. **Test Edge Cases**: Test boundary conditions and error cases
4. **Mock External Contracts**: Use test doubles for external dependencies
5. **Assert Thoroughly**: Verify both state changes and return values

---

## Debugging

### Enable Debug Logging

```rust
use soroban_sdk::{contract, contractimpl, Env, log};

#[contractimpl]
impl MyContract {
    pub fn debug_operation(env: Env) {
        log!(&env, "Starting debug operation");
        
        // Your code here
        
        log!(&env, "Debug operation completed");
    }
}
```

### Common Issues

#### 1. Unauthorized Operation

**Error**: `InvokeHostFunctionResultCode::InvokeHostFunctionResultCodeInvokeHostFunctionMalformed`

**Solution**: Ensure address authorization:

```rust
// Wrong - missing require_auth()
pub fn transfer(env: Env, to: Address) { }

// Correct
pub fn transfer(env: Env, from: Address, to: Address) {
    from.require_auth();
    // ...
}
```

#### 2. Storage Access Errors

**Error**: `xdr::ReadXdrError`

**Solution**: Check storage key types:

```rust
// Consistent key types
let key = "my_key".into_val(&env);
storage.set(&key, &value);
let retrieved = storage.get::<_, Value>(&key); // Specify type
```

#### 3. WASM Size Limits

**Solution**: Optimize code size:

```bash
# Check WASM size
cargo build --release --target wasm32-unknown-unknown
ls -lh target/wasm32-unknown-unknown/release/my_contract.wasm

# Optimize
cargo build --release --target wasm32-unknown-unknown -C opt-level=z
```

### Debugging Tools

- **Stellar CLI**: `soroban contract invoke --network testnet ...`
- **Test Environment**: Use `Env::default()` in tests
- **Logs**: Emit events and check contract logs

---

## Performance Optimization

### 1. Memory Efficiency

```rust
// Inefficient - creates temporary vectors
pub fn sum(env: Env, values: Vec<u32>) -> u128 {
    let mut temp = Vec::new(&env);
    for v in values {
        temp.push_back(v);
    }
    // Sum operations
}

// Efficient - processes directly
pub fn sum(env: Env, values: Vec<u32>) -> u128 {
    values.iter().fold(0u128, |acc, v| acc + v as u128)
}
```

### 2. Storage Access Optimization

```rust
// Inefficient - multiple storage reads
pub fn get_multiple(env: Env, keys: Vec<String>) -> u128 {
    let storage = env.storage().persistent();
    let mut sum = 0u128;
    
    for key in keys {
        let val: u128 = storage.get(&key.into_val(&env)).unwrap_or(0);
        sum += val;
    }
    sum
}

// Efficient - batch or cache reads when possible
pub fn get_multiple_cached(env: Env, keys: Vec<String>) -> u128 {
    let storage = env.storage().persistent();
    let mut sum = 0u128;
    
    // Cache key references
    let prepared_keys: Vec<_> = keys
        .iter()
        .map(|k| k.into_val(&env))
        .collect();
    
    for key in prepared_keys {
        let val: u128 = storage.get(&key).unwrap_or(0);
        sum += val;
    }
    sum
}
```

### 3. Computation Optimization

```rust
// Use native types when possible
pub fn calculate(value: u128) -> u128 {
    // Native arithmetic is faster
    value * 2 + 1
}

// Avoid unnecessary conversions
pub fn efficient(env: Env, val: u32) -> u32 {
    // Minimize conversions
    val + 1
}
```

### Performance Benchmarking

```bash
# Measure contract execution time
time soroban contract invoke \
  --network testnet \
  --id CAAAA... \
  --fn_name my_function \
  --arg ...
```

---

## Common Patterns

### 1. Initialization Pattern

```rust
#[contractimpl]
impl MyContract {
    pub fn initialize(env: Env, owner: Address, initial_value: u32) {
        // Check if already initialized
        let storage = env.storage().persistent();
        if storage.has(&"initialized".into_val(&env)) {
            env.panic_with_error(Error::AlreadyInitialized);
        }

        // Set owner
        storage.set(&"owner".into_val(&env), &owner);
        
        // Set initial value
        storage.set(&"value".into_val(&env), &initial_value);
        
        // Mark as initialized
        storage.set(&"initialized".into_val(&env), &true);
    }
}

enum Error {
    AlreadyInitialized,
}
```

### 2. Callback Pattern

```rust
pub trait Callback {
    fn on_complete(env: Env, result: u32);
}

#[contractimpl]
impl AsyncOperation {
    pub fn perform_with_callback(
        env: Env,
        callback: Address,
    ) {
        // Perform operation
        let result = 42;

        // Invoke callback
        invoke_contract(&env, callback, Symbol::short("on_complete"), result);
    }
}
```

### 3. Event Pattern

```rust
#[contractimpl]
impl EventEmitter {
    pub fn emit_transfer(env: Env, from: Address, to: Address, amount: u128) {
        from.require_auth();

        // Emit event
        env.events().publish(("transfer", from.clone(), to.clone()), amount);

        // Perform transfer
    }
}
```

---

## Security Best Practices

### 1. Input Validation

```rust
#[contractimpl]
impl SafeContract {
    pub fn set_amount(env: Env, amount: u128) {
        // Validate input
        if amount == 0 {
            env.panic_with_error(Error::AmountCannotBeZero);
        }
        if amount > MAX_AMOUNT {
            env.panic_with_error(Error::AmountExceedsLimit);
        }

        env.storage()
            .persistent()
            .set(&"amount".into_val(&env), &amount);
    }
}

const MAX_AMOUNT: u128 = 1_000_000_000_000; // 1 trillion

enum Error {
    AmountCannotBeZero,
    AmountExceedsLimit,
}
```

### 2. Authorization Checks

```rust
pub fn critical_operation(env: Env, admin: Address) {
    // Always check authorization first
    admin.require_auth();

    // Then perform operation
    // ...
}
```

### 3. State Consistency

```rust
#[contractimpl]
impl ConsistentContract {
    pub fn transfer(env: Env, from: Address, to: Address, amount: u128) {
        from.require_auth();

        let storage = env.storage().persistent();

        // Read initial state
        let from_balance = get_balance(&storage, &from, &env);
        let to_balance = get_balance(&storage, &to, &env);

        // Validate preconditions
        if from_balance < amount {
            env.panic_with_error(Error::InsufficientBalance);
        }

        // Update state
        storage.set(
            &format!("balance:{}", from.to_string()).into_val(&env),
            &(from_balance - amount),
        );
        storage.set(
            &format!("balance:{}", to.to_string()).into_val(&env),
            &(to_balance + amount),
        );

        // Emit event
        env.events().publish(("transfer", from.clone(), to.clone()), amount);
    }
}

fn get_balance(storage: &Storage, account: &Address, env: &Env) -> u128 {
    storage
        .get(&format!("balance:{}", account.to_string()).into_val(env))
        .unwrap_or(0)
}

enum Error {
    InsufficientBalance,
}
```

---

## Deployment

### Testnet Deployment

```bash
# Build contract
cargo build --release --target wasm32-unknown-unknown

# Deploy to testnet
soroban contract deploy \
  --network testnet \
  --source <ACCOUNT_SECRET> \
  --wasm target/wasm32-unknown-unknown/release/my_contract.wasm
```

### Mainnet Deployment

```bash
# Deploy to mainnet
soroban contract deploy \
  --network public \
  --source <ACCOUNT_SECRET> \
  --wasm target/wasm32-unknown-unknown/release/my_contract.wasm
```

---

## Resources

- [Official Soroban Documentation](https://developers.stellar.org/docs/build/smart-contracts)
- [Soroban SDK Repository](https://github.com/stellar/rs-soroban-sdk)
- [Stellar Developer Forum](https://stellar.expert/)
- [Example Contracts](https://github.com/stellar/soroban-examples)

---

## Next Steps

After completing this course, you should:

1. Understand Soroban contract fundamentals
2. Be able to write and deploy basic contracts
3. Know how to test contracts thoroughly
4. Understand performance optimization techniques
5. Be familiar with common security patterns

Continue by exploring the official Soroban examples and contributing to the Stellar ecosystem!
