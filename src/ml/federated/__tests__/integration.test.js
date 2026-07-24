// Tests for Federated Learning Integration
const { FederatedLearningIntegration } = require('../integration');

describe('FederatedLearningIntegration', () => {
  let integration;

  beforeEach(() => {
    integration = new FederatedLearningIntegration({
      enableFederatedLearning: true,
      federatedServerUrl: 'http://localhost:4002',
      privacy: {
        epsilon: 1.0,
        delta: 1e-5
      }
    });
  });

  test('should initialize with correct configuration', () => {
    expect(integration.enableFederatedLearning).toBe(true);
    expect(integration.federatedServerUrl).toBe('http://localhost:4002');
    expect(integration.privacyConfig.epsilon).toBe(1.0);
  });

  test('should get federated learning status', () => {
    const status = integration.getFederatedStatus();
    
    expect(status).toBeDefined();
    expect(status.enabled).toBe(true);
    expect(status.initialized).toBe(false);
    expect(status.serverUrl).toBe('http://localhost:4002');
  });

  test('should handle disabled federated learning', () => {
    const disabledIntegration = new FederatedLearningIntegration({
      enableFederatedLearning: false
    });
    
    const status = disabledIntegration.getFederatedStatus();
    expect(status.enabled).toBe(false);
  });

  test('should initialize federated learning system', async () => {
    const initialized = await integration.initialize();
    
    expect(typeof initialized).toBe('boolean');
  });

  test('should handle initialization with disabled federated learning', async () => {
    const disabledIntegration = new FederatedLearningIntegration({
      enableFederatedLearning: false
    });
    
    const initialized = await disabledIntegration.initialize();
    expect(initialized).toBe(false);
  });
});
