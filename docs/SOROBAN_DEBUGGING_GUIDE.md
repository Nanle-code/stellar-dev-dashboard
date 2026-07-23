# Soroban Contract Debugging Guide

Comprehensive guide for debugging Soroban smart contracts during development and deployment.

## Table of Contents

1. [Local Development Debugging](#local-development-debugging)
2. [Testnet Debugging](#testnet-debugging)
3. [Common Errors](#common-errors)
4. [Debugging Techniques](#debugging-techniques)
5. [Performance Profiling](#performance-profiling)
6. [Production Debugging](#production-debugging)

---

## Local Development Debugging

### 1. Unit Test Debugging

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn test_with_debug_output() {
        let env = Env::default();
        
        // Debug: Print environment info
        println!("Ledger: {:?}", env.ledger().sequence());
        println!("Timestamp: {:?}", env.ledger().timestamp());

        let admin = Address::random(&env);
        println!("Admin address: {}", admin.to_string());
        
        // Run operation
        MyContract::initialize(env.clone(), admin);
        
        // Verify state
        let stored = get_admin(&env);
        println!("Stored admin: {}", stored.to_string());
        
        assert_eq!(stored, admin);
    }

    #[test]
    fn test_error_propagation() {
        let env = Env::default();
        
        // Test error handling
        let result = MyContract::invalid_operation(env);
        
        match result {
            Err(e) => println!("Error occurred: {:?}", e),
            Ok(_) => panic!("Expected error but got success"),
        }
    }
}
```

### 2. Logging in Tests

```rust
use soroban_sdk::{log, Env};

#[cfg(test)]
mod tests {
    #[test]
    fn test_with_logging() {
        let env = Env::default();
        
        log!(&env, "Test starting");
        
        let value = calculate_something(&env);
        log!(&env, "Calculated value: {}", value);
        
        log!(&env, "Test completed");
    }
}

pub fn calculate_something(env: &Env) -> u128 {
    log!(&env, "Entering calculate_something");
    
    let result = 42;
    log!(&env, "Result: {}", result);
    
    result
}
```

### 3. Assertion Helpers

```rust
#[cfg(test)]
mod tests {
    use super::*;

    fn assert_balance(env: &Env, account: &Address, expected: u128) {
        let actual = get_balance(env, account);
        assert_eq!(
            actual, expected,
            "Balance mismatch for {}: expected {}, got {}",
            account.to_string(),
            expected,
            actual
        );
    }

    #[test]
    fn test_transfer_updates_balances() {
        let env = Env::default();
        let alice = Address::random(&env);
        let bob = Address::random(&env);

        set_balance(&env, &alice, 1000);
        set_balance(&env, &bob, 500);

        transfer(&env, &alice, &bob, 200).unwrap();

        assert_balance(&env, &alice, 800);
        assert_balance(&env, &bob, 700);
    }
}
```

---

## Testnet Debugging

### 1. Viewing Contract Logs

```bash
# Deploy contract to testnet
soroban contract deploy \
  --network testnet \
  --source <SOURCE> \
  --wasm target/wasm32-unknown-unknown/release/my_contract.wasm

# Invoke and capture logs
soroban contract invoke \
  --network testnet \
  --id <CONTRACT_ID> \
  --fn_name my_function \
  --arg <ARGS> \
  --log debug

# Check transaction details
soroban contract inspect \
  --network testnet \
  --id <CONTRACT_ID>
```

### 2. Transaction Simulation

```bash
# Simulate transaction without executing
soroban contract invoke \
  --network testnet \
  --id <CONTRACT_ID> \
  --fn_name my_function \
  --arg <ARGS> \
  --simulate

# Get fee estimate
soroban contract invoke \
  --network testnet \
  --id <CONTRACT_ID> \
  --fn_name my_function \
  --arg <ARGS> \
  --simulate --log debug
```

### 3. Event Inspection

```bash
# Get contract events
soroban contract inspect \
  --network testnet \
  --id <CONTRACT_ID> \
  --events

# Filter events by type
soroban contract inspect \
  --network testnet \
  --id <CONTRACT_ID> \
  --events \
  --filter transfer
```

---

## Common Errors

### 1. Authorization Error

**Error**: `InvokeHostFunctionResultCode::InvokeHostFunctionResultCodeAuthorizationError`

**Cause**: Missing or incorrect `require_auth()` call

**Solution**:

```rust
// WRONG
pub fn transfer(env: Env, from: Address, to: Address, amount: u128) {
    let storage = env.storage().persistent();
    // Missing from.require_auth()
    update_balance(&env, &from, get_balance(&env, &from) - amount);
}

// CORRECT
pub fn transfer(env: Env, from: Address, to: Address, amount: u128) {
    from.require_auth();  // Add this line
    
    let storage = env.storage().persistent();
    update_balance(&env, &from, get_balance(&env, &from) - amount);
}
```

**Debug Steps**:

```rust
#[test]
fn debug_authorization() {
    let env = Env::default();
    let user = Address::random(&env);
    
    // Test without authorization should fail
    let result = MyContract::protected_operation(env.clone(), user.clone());
    assert!(result.is_err(), "Should fail without auth");
    
    // But direct call should work
    user.require_auth();  // Manually auth in test
    let result = MyContract::protected_operation(env, user);
    assert!(result.is_ok(), "Should succeed with auth");
}
```

### 2. Storage Type Mismatch

**Error**: `xdr::ReadXdrError` or runtime panic

**Cause**: Reading storage with wrong type

**Solution**:

```rust
// WRONG - Storing u128, reading u32
let storage = env.storage().persistent();
let key = "balance".into_val(&env);
storage.set(&key, &1000u128);

let balance: u32 = storage.get(&key).unwrap_or(0);  // Type mismatch!

// CORRECT - Consistent types
let storage = env.storage().persistent();
let key = "balance".into_val(&env);
storage.set(&key, &1000u128);

let balance: u128 = storage.get(&key).unwrap_or(0);  // Same type
```

**Debug Steps**:

```rust
fn debug_storage_types(env: &Env) {
    let storage = env.storage().persistent();
    let key = "debug_key".into_val(env);
    
    // Store value
    let value = 1000u128;
    storage.set(&key, &value);
    
    // Retrieve with correct type
    let retrieved: u128 = storage.get(&key).unwrap_or(0);
    println!("Stored: {}, Retrieved: {}", value, retrieved);
    
    // Try with wrong type (will fail)
    // let wrong: u32 = storage.get(&key).unwrap_or(0);  // Don't do this
}
```

### 3. Overflow Error

**Error**: `arithmetic operation overflowed` (in debug build)

**Cause**: Integer arithmetic overflow

**Solution**:

```rust
// WRONG - No overflow protection
pub fn add(a: u128, b: u128) -> u128 {
    a + b  // Can overflow!
}

// CORRECT - Checked arithmetic
pub fn add(a: u128, b: u128) -> Result<u128, Error> {
    a.checked_add(b)
        .ok_or(Error::Overflow)
}

// Usage
let result = add(u128::MAX, 1)?;  // Error::Overflow
```

**Debug Steps**:

```rust
#[test]
fn test_overflow_detection() {
    let max_value = u128::MAX;
    
    // This will panic without checked arithmetic
    let result = max_value.checked_add(1);
    
    assert!(result.is_none(), "Overflow should be detected");
    
    // Safe operation
    let result = max_value.checked_add(0);
    assert!(result.is_some(), "Non-overflow should succeed");
}
```

### 4. Invalid Contract ID

**Error**: `ContractNotFound` or `InvalidContractId`

**Cause**: Contract doesn't exist on network

**Solution**:

```bash
# Verify contract exists
soroban contract inspect \
  --network testnet \
  --id <CONTRACT_ID>

# If not found, check if deployed to correct network
# List contracts deployed from account
soroban contract list \
  --network testnet \
  --source <ACCOUNT_SECRET>

# Redeploy if necessary
soroban contract deploy \
  --network testnet \
  --source <ACCOUNT_SECRET> \
  --wasm my_contract.wasm
```

### 5. Insufficient Balance Error

**Error**: `Insufficient balance for operation`

**Cause**: Account doesn't have enough XLM for fees

**Solution**:

```bash
# Check account balance
soroban account info \
  --network testnet \
  --source-account <ACCOUNT_ID>

# Fund account from testnet faucet if needed
# Visit: https://laboratory.stellar.org/?network=test#account-creator

# Or send XLM from another account
soroban payment \
  --network testnet \
  --source <SOURCE_SECRET> \
  --to <RECIPIENT> \
  --amount 10  # XLM
```

---

## Debugging Techniques

### 1. Minimal Test Case

Isolate the problematic behavior:

```rust
#[test]
fn test_minimal_case() {
    let env = Env::default();
    
    // Minimal reproduction of the issue
    let result = MyContract::problematic_function(env.clone());
    
    // Add incremental complexity until you find the issue
    println!("Result: {:?}", result);
    assert!(result.is_ok());
}
```

### 2. State Inspection

```rust
fn inspect_state(env: &Env, account: &Address) {
    let storage = env.storage().persistent();
    
    println!("=== Contract State ===");
    println!("Account: {}", account.to_string());
    
    let balance_key = format!("balance:{}", account.to_string()).into_val(env);
    if let Some(balance) = storage.get::<_, u128>(&balance_key) {
        println!("Balance: {}", balance);
    }
    
    let total_key = "total".into_val(env);
    if let Some(total) = storage.get::<_, u128>(&total_key) {
        println!("Total: {}", total);
    }
    
    println!("=====================");
}

#[test]
fn test_with_state_inspection() {
    let env = Env::default();
    let account = Address::random(&env);
    
    inspect_state(&env, &account);
    
    transfer(&env, &account, &Address::random(&env), 100).unwrap();
    
    inspect_state(&env, &account);
}
```

### 3. Execution Tracing

```rust
pub fn trace_execution<T>(
    env: &Env,
    name: &str,
    f: impl FnOnce() -> Result<T, Error>,
) -> Result<T, Error> {
    println!(">>> Entering {}", name);
    
    match f() {
        Ok(result) => {
            println!("<<< Exiting {} (success)", name);
            Ok(result)
        }
        Err(e) => {
            println!("<<< Exiting {} (error: {:?})", name, e);
            Err(e)
        }
    }
}

#[test]
fn test_with_tracing() {
    let env = Env::default();
    
    trace_execution(&env, "initialize", || {
        MyContract::initialize(env.clone(), Address::random(&env))
    }).unwrap();
    
    trace_execution(&env, "do_something", || {
        MyContract::do_something(env.clone())
    }).unwrap();
}
```

### 4. Binary Search Debugging

For complex issues, isolate which operation causes the problem:

```rust
#[test]
fn binary_search_debug() {
    let env = Env::default();
    
    // Step 1: Does initialization work?
    MyContract::init(env.clone()).ok()?;
    println!("✓ Initialization works");
    
    // Step 2: Does single operation work?
    MyContract::operation_1(env.clone()).ok()?;
    println!("✓ Operation 1 works");
    
    // Step 3: Does operation 2 work?
    MyContract::operation_2(env.clone()).ok()?;
    println!("✓ Operation 2 works");
    
    // Step 4: Do both operations work?
    MyContract::operation_1(env.clone()).ok()?;
    MyContract::operation_2(env.clone()).ok()?;
    println!("✓ Both operations work");
}
```

---

## Performance Profiling

### 1. Timing Operations

```rust
use std::time::Instant;

fn time_operation<T>(
    name: &str,
    f: impl FnOnce() -> T,
) -> T {
    let start = Instant::now();
    let result = f();
    let elapsed = start.elapsed();
    println!("{} took: {:?}", name, elapsed);
    result
}

#[test]
fn profile_contract_operations() {
    let env = Env::default();
    
    time_operation("initialize", || {
        MyContract::initialize(env.clone(), Address::random(&env))
    });
    
    time_operation("operation", || {
        MyContract::some_operation(env.clone())
    });
}
```

### 2. Memory Usage Profiling

```bash
# Check contract size
ls -lh target/wasm32-unknown-unknown/release/my_contract.wasm

# Optimize with LTO
cargo build --release \
  --target wasm32-unknown-unknown \
  -C opt-level=z \
  -C lto=true

# Analyze size
cargo install cargo-wasm

cargo wasm --release
```

### 3. Gas Estimation

```bash
# Estimate transaction fees
soroban contract invoke \
  --network testnet \
  --id <CONTRACT_ID> \
  --fn_name my_function \
  --arg <ARGS> \
  --simulate \
  --log debug | grep "gasUsed\|fee"
```

---

## Production Debugging

### 1. Event Logging

```rust
pub fn log_transaction(
    env: &Env,
    tx_hash: String,
    status: &str,
    details: &str,
) {
    env.events().publish(
        ("transaction", tx_hash.clone()),
        (status, details),
    );
}

#[test]
fn test_event_emission() {
    let env = Env::default();
    
    log_transaction(&env, "tx123".to_string(), "success", "Transfer completed");
    
    // Verify events were emitted
}
```

### 2. Metrics Collection

```rust
pub struct Metrics {
    total_transfers: u128,
    failed_operations: u128,
    total_fees: u128,
}

pub fn record_metric(env: &Env, metric_type: &str, value: u128) {
    let storage = env.storage().persistent();
    let key = format!("metric:{}", metric_type).into_val(env);
    
    let current: u128 = storage.get(&key).unwrap_or(0);
    storage.set(&key, &(current + value));
}

pub fn get_metrics(env: &Env) -> Metrics {
    let storage = env.storage().persistent();
    
    Metrics {
        total_transfers: storage
            .get(&"metric:transfers".into_val(env))
            .unwrap_or(0),
        failed_operations: storage
            .get(&"metric:failures".into_val(env))
            .unwrap_or(0),
        total_fees: storage
            .get(&"metric:fees".into_val(env))
            .unwrap_or(0),
    }
}
```

### 3. Health Checks

```rust
pub fn health_check(env: &Env) -> Result<HealthStatus, Error> {
    let storage = env.storage().persistent();
    
    // Check critical state
    let initialized: bool = storage
        .get(&"initialized".into_val(env))
        .unwrap_or(false);
    
    if !initialized {
        return Err(Error::NotInitialized);
    }
    
    // Check consistency
    let total: u128 = storage.get(&"total".into_val(env)).unwrap_or(0);
    if total == 0 {
        return Err(Error::InvalidState);
    }
    
    Ok(HealthStatus {
        is_healthy: true,
        message: "Contract is operating normally".to_string(),
    })
}

#[derive(Debug)]
pub struct HealthStatus {
    is_healthy: bool,
    message: String,
}
```

---

## Debugging Checklist

Before production deployment:

- [ ] All tests pass locally
- [ ] Testnet deployment successful
- [ ] No authorization errors
- [ ] No storage type mismatches
- [ ] No arithmetic overflows
- [ ] Contract can be invoked without errors
- [ ] Performance acceptable
- [ ] Events are properly emitted
- [ ] Error handling is comprehensive
- [ ] Health checks pass

---

## Resources

- [Soroban CLI Documentation](https://developers.stellar.org/docs/build/tools/stellar-cli)
- [Rust Debugging Guide](https://docs.rust-embedded.org/book/debugging/)
- [Stellar Expert Contract Viewer](https://stellar.expert/explorer/contract)
