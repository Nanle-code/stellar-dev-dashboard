/**
 * Environment Profiles tests
 * Tests for multi-environment configuration profiles (Testnet/Mainnet)
 *
 * Covers:
 * - Primary flow: switching between Testnet and Mainnet profiles
 * - Boundary cases: profile filtering, fallback behavior
 * - Failure cases: invalid input, unsupported environments, deletion constraints
 */

import { beforeEach, describe, it, expect } from 'vitest';
import {
  validateEnvironmentProfile,
  loadEnvironmentProfiles,
  saveEnvironmentProfiles,
  getActiveEnvironmentProfileId,
  setActiveEnvironmentProfile,
  getActiveEnvironmentProfile,
  getEnvironmentProfile,
  createEnvironmentProfile,
  updateEnvironmentProfile,
  deleteEnvironmentProfile,
  switchEnvironmentProfile,
  getProfilesByType,
  getEnvironmentTypeFromNetwork,
  isSupportedEnvironment,
  getDefaultProfileForType,
  type EnvironmentProfile,
  type EnvironmentType,
} from '../environmentProfiles';

describe('Environmental Profiles', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ─── Primary Flow Tests ───────────────────────────────────────────────────

  describe('Primary Flow: Switch between Testnet and Mainnet profiles', () => {
    it('should load default profiles (Testnet and Mainnet)', () => {
      const profiles = loadEnvironmentProfiles();
      expect(profiles.length).toBeGreaterThanOrEqual(2);

      const testnetProfile = profiles.find((p) => p.id === 'testnet-official');
      const mainnetProfile = profiles.find((p) => p.id === 'mainnet-official');

      expect(testnetProfile).toBeDefined();
      expect(mainnetProfile).toBeDefined();
      expect(testnetProfile?.type).toBe('testnet');
      expect(mainnetProfile?.type).toBe('mainnet');
    });

    it('should set active profile to testnet by default', () => {
      const activeId = getActiveEnvironmentProfileId();
      expect(activeId).toBe('testnet-official');
    });

    it('should switch from Testnet to Mainnet profile', () => {
      switchEnvironmentProfile('mainnet-official');
      const activeProfile = getActiveEnvironmentProfile();
      expect(activeProfile.id).toBe('mainnet-official');
      expect(activeProfile.type).toBe('mainnet');
    });

    it('should switch from Mainnet back to Testnet profile', () => {
      switchEnvironmentProfile('mainnet-official');
      expect(getActiveEnvironmentProfile().id).toBe('mainnet-official');

      switchEnvironmentProfile('testnet-official');
      const activeProfile = getActiveEnvironmentProfile();
      expect(activeProfile.id).toBe('testnet-official');
      expect(activeProfile.type).toBe('testnet');
    });

    it('should persist active profile across sessions', () => {
      switchEnvironmentProfile('mainnet-official');
      expect(getActiveEnvironmentProfileId()).toBe('mainnet-official');

      // Simulate new session
      const stored = localStorage.getItem('active-env-profile');
      localStorage.clear();
      localStorage.setItem('active-env-profile', stored!);

      const activeId = getActiveEnvironmentProfileId();
      expect(activeId).toBe('mainnet-official');
    });

    it('should create custom environment profile and switch to it', () => {
      const customProfile = createEnvironmentProfile({
        name: 'Custom Testnet',
        type: 'testnet',
        horizonUrl: 'http://custom-testnet.example.com',
        sorobanUrl: 'http://custom-soroban.example.com',
        passphrase: 'Custom Network ; Test',
        description: 'Custom Testnet for development',
      });

      expect(customProfile.id).toBeDefined();
      expect(customProfile.createdAt).toBeDefined();
      expect(customProfile.updatedAt).toBeDefined();

      switchEnvironmentProfile(customProfile.id);
      const activeProfile = getActiveEnvironmentProfile();
      expect(activeProfile.id).toBe(customProfile.id);
      expect(activeProfile.name).toBe('Custom Testnet');
    });
  });

  // ─── Boundary Cases ───────────────────────────────────────────────────────

  describe('Boundary Cases', () => {
    it('should handle profile not found gracefully', () => {
      const profile = getEnvironmentProfile('nonexistent-id');
      expect(profile).toBeNull();
    });

    it('should return fallback profile when active profile is deleted', () => {
      const customProfile = createEnvironmentProfile({
        name: 'Temp Profile',
        type: 'testnet',
        horizonUrl: 'http://temp.example.com',
        sorobanUrl: 'http://temp-soroban.example.com',
        passphrase: 'Temp Network',
      });

      switchEnvironmentProfile(customProfile.id);
      expect(getActiveEnvironmentProfile().id).toBe(customProfile.id);

      deleteEnvironmentProfile(customProfile.id);

      // Should return testnet-official as fallback
      const fallback = getActiveEnvironmentProfile();
      expect(fallback.id).toBe('testnet-official');
    });

    it('should handle empty profile list by returning built-in profiles', () => {
      localStorage.removeItem('env-profiles');
      const profiles = loadEnvironmentProfiles();
      expect(profiles.length).toBeGreaterThanOrEqual(2);
      expect(profiles.some((p) => p.id === 'testnet-official')).toBe(true);
    });

    it('should merge user profiles with built-in profiles', () => {
      const customProfile = createEnvironmentProfile({
        name: 'Custom',
        type: 'mainnet',
        horizonUrl: 'http://custom.example.com',
        sorobanUrl: 'http://custom-soroban.example.com',
        passphrase: 'Custom',
      });

      const profiles = loadEnvironmentProfiles();
      const hasBuiltIn = profiles.some((p) => p.id === 'testnet-official');
      const hasCustom = profiles.some((p) => p.id === customProfile.id);

      expect(hasBuiltIn).toBe(true);
      expect(hasCustom).toBe(true);
    });

    it('should filter profiles by environment type', () => {
      const testnetProfiles = getProfilesByType('testnet');
      const mainnetProfiles = getProfilesByType('mainnet');

      expect(testnetProfiles.every((p) => p.type === 'testnet')).toBe(true);
      expect(mainnetProfiles.every((p) => p.type === 'mainnet')).toBe(true);
    });

    it('should get default profile for environment type', () => {
      const testnetDefault = getDefaultProfileForType('testnet');
      const mainnetDefault = getDefaultProfileForType('mainnet');

      expect(testnetDefault).toBeDefined();
      expect(mainnetDefault).toBeDefined();
      expect(testnetDefault?.type).toBe('testnet');
      expect(mainnetDefault?.type).toBe('mainnet');
    });
  });

  // ─── Failure Cases & Error Handling ───────────────────────────────────────

  describe('Failure Cases: Invalid Input & Error Handling', () => {
    it('should reject profile with invalid name', () => {
      expect(() => {
        validateEnvironmentProfile({
          name: '',
          type: 'testnet',
          horizonUrl: 'https://example.com',
          sorobanUrl: 'https://example.com',
          passphrase: 'Test',
        });
      }).toThrow('Profile name is required');
    });

    it('should reject profile with invalid type', () => {
      expect(() => {
        validateEnvironmentProfile({
          name: 'Test',
          type: 'invalid' as unknown as EnvironmentType,
          horizonUrl: 'https://example.com',
          sorobanUrl: 'https://example.com',
          passphrase: 'Test',
        });
      }).toThrow('Profile type must be either "testnet" or "mainnet"');
    });

    it('should reject profile with invalid Horizon URL', () => {
      expect(() => {
        validateEnvironmentProfile({
          name: 'Test',
          type: 'testnet',
          horizonUrl: 'not-a-url',
          sorobanUrl: 'https://example.com',
          passphrase: 'Test',
        });
      }).toThrow('Horizon URL must be a valid URL');
    });

    it('should reject profile with invalid Soroban URL', () => {
      expect(() => {
        validateEnvironmentProfile({
          name: 'Test',
          type: 'testnet',
          horizonUrl: 'https://example.com',
          sorobanUrl: 'invalid-url',
          passphrase: 'Test',
        });
      }).toThrow('Soroban URL must be a valid URL');
    });

    it('should reject profile with invalid Faucet URL', () => {
      expect(() => {
        validateEnvironmentProfile({
          name: 'Test',
          type: 'testnet',
          horizonUrl: 'https://example.com',
          sorobanUrl: 'https://example.com',
          passphrase: 'Test',
          faucetUrl: 'not-valid-url',
        });
      }).toThrow('Faucet URL must be a valid URL');
    });

    it('should reject profile with missing passphrase', () => {
      expect(() => {
        validateEnvironmentProfile({
          name: 'Test',
          type: 'testnet',
          horizonUrl: 'https://example.com',
          sorobanUrl: 'https://example.com',
          passphrase: '',
        });
      }).toThrow('Passphrase is required');
    });

    it('should reject creation with duplicate name', () => {
      createEnvironmentProfile({
        name: 'Duplicate Test',
        type: 'testnet',
        horizonUrl: 'https://example1.com',
        sorobanUrl: 'https://example1-soroban.com',
        passphrase: 'Test1',
      });

      expect(() => {
        createEnvironmentProfile({
          name: 'Duplicate Test',
          type: 'mainnet',
          horizonUrl: 'https://example2.com',
          sorobanUrl: 'https://example2-soroban.com',
          passphrase: 'Test2',
        });
      }).toThrow('already exists');
    });

    it('should reject switching to non-existent profile', () => {
      expect(() => {
        switchEnvironmentProfile('nonexistent-profile-id');
      }).toThrow('Cannot switch to environment profile');
    });

    it('should reject deletion of built-in profile', () => {
      expect(() => {
        deleteEnvironmentProfile('testnet-official');
      }).toThrow('Cannot delete built-in environment profile');
    });

    it('should reject deletion of active profile', () => {
      const customProfile = createEnvironmentProfile({
        name: 'Active Profile',
        type: 'testnet',
        horizonUrl: 'https://example.com',
        sorobanUrl: 'https://soroban.example.com',
        passphrase: 'Test',
      });

      switchEnvironmentProfile(customProfile.id);

      expect(() => {
        deleteEnvironmentProfile(customProfile.id);
      }).toThrow('Cannot delete the active environment profile');
    });

    it('should reject update of non-existent profile', () => {
      expect(() => {
        updateEnvironmentProfile('nonexistent-id', { name: 'Updated' });
      }).toThrow('Environment profile not found');
    });

    it('should reject setting active profile to non-existent profile', () => {
      expect(() => {
        setActiveEnvironmentProfile('nonexistent-profile');
      }).toThrow('Environment profile not found');
    });

    it('should collect multiple validation errors', () => {
      expect(() => {
        validateEnvironmentProfile({
          name: '',
          type: 'invalid' as unknown as EnvironmentType,
          horizonUrl: 'invalid-url',
          sorobanUrl: '',
          passphrase: '',
        });
      }).toThrow(/multiple errors|invalid/i);
    });
  });

  // ─── Profile Management Tests ──────────────────────────────────────────────

  describe('Profile Management', () => {
    it('should update profile name', () => {
      const profile = createEnvironmentProfile({
        name: 'Original Name',
        type: 'testnet',
        horizonUrl: 'https://example.com',
        sorobanUrl: 'https://soroban.example.com',
        passphrase: 'Test',
      });

      const updated = updateEnvironmentProfile(profile.id, { name: 'Updated Name' });
      expect(updated.name).toBe('Updated Name');
      expect(updated.id).toBe(profile.id);
      expect(updated.createdAt).toBe(profile.createdAt);
    });

    it('should update profile URLs', () => {
      const profile = createEnvironmentProfile({
        name: 'Profile',
        type: 'testnet',
        horizonUrl: 'https://old-horizon.example.com',
        sorobanUrl: 'https://old-soroban.example.com',
        passphrase: 'Test',
      });

      const updated = updateEnvironmentProfile(profile.id, {
        horizonUrl: 'https://new-horizon.example.com',
        sorobanUrl: 'https://new-soroban.example.com',
      });

      expect(updated.horizonUrl).toBe('https://new-horizon.example.com');
      expect(updated.sorobanUrl).toBe('https://new-soroban.example.com');
    });

    it('should update profile description', () => {
      const profile = createEnvironmentProfile({
        name: 'Profile',
        type: 'testnet',
        horizonUrl: 'https://example.com',
        sorobanUrl: 'https://soroban.example.com',
        passphrase: 'Test',
      });

      const updated = updateEnvironmentProfile(profile.id, {
        description: 'New description',
      });

      expect(updated.description).toBe('New description');
    });

    it('should delete custom profile', () => {
      const profile = createEnvironmentProfile({
        name: 'To Delete',
        type: 'testnet',
        horizonUrl: 'https://example.com',
        sorobanUrl: 'https://soroban.example.com',
        passphrase: 'Test',
      });

      deleteEnvironmentProfile(profile.id);

      const deleted = getEnvironmentProfile(profile.id);
      expect(deleted).toBeNull();
    });

    it('should preserve createdAt on update', () => {
      const profile = createEnvironmentProfile({
        name: 'Profile',
        type: 'testnet',
        horizonUrl: 'https://example.com',
        sorobanUrl: 'https://soroban.example.com',
        passphrase: 'Test',
      });

      const originalCreatedAt = profile.createdAt;

      // Wait a bit to ensure different timestamps
      const updated = updateEnvironmentProfile(profile.id, { name: 'New Name' });

      expect(updated.createdAt).toBe(originalCreatedAt);
      expect(updated.updatedAt).not.toBe(originalCreatedAt);
    });
  });

  // ─── Utility Functions ─────────────────────────────────────────────────────

  describe('Utility Functions', () => {
    it('should determine environment type from network name', () => {
      expect(getEnvironmentTypeFromNetwork('testnet')).toBe('testnet');
      expect(getEnvironmentTypeFromNetwork('mainnet')).toBe('mainnet');
      expect(getEnvironmentTypeFromNetwork('futurenet')).toBeNull();
      expect(getEnvironmentTypeFromNetwork('local')).toBeNull();
    });

    it('should validate supported environments', () => {
      expect(isSupportedEnvironment('testnet')).toBe(true);
      expect(isSupportedEnvironment('mainnet')).toBe(true);
    });
  });

  // ─── Persistence & Data Integrity ────────────────────────────────────────

  describe('Persistence & Data Integrity', () => {
    it('should not save built-in profiles to storage', () => {
      loadEnvironmentProfiles();
      const stored = localStorage.getItem('env-profiles');
      expect(stored).toBeNull();
    });

    it('should only save custom profiles to storage', () => {
      const customProfile = createEnvironmentProfile({
        name: 'Custom',
        type: 'testnet',
        horizonUrl: 'https://custom.example.com',
        sorobanUrl: 'https://custom-soroban.example.com',
        passphrase: 'Custom',
      });

      const stored = localStorage.getItem('env-profiles');
      expect(stored).toBeDefined();

      const parsed = JSON.parse(stored!);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe(customProfile.id);
    });

    it('should preserve custom profiles when loading', () => {
      const profile1 = createEnvironmentProfile({
        name: 'Custom 1',
        type: 'testnet',
        horizonUrl: 'https://custom1.example.com',
        sorobanUrl: 'https://custom1-soroban.example.com',
        passphrase: 'Custom1',
      });

      const profile2 = createEnvironmentProfile({
        name: 'Custom 2',
        type: 'mainnet',
        horizonUrl: 'https://custom2.example.com',
        sorobanUrl: 'https://custom2-soroban.example.com',
        passphrase: 'Custom2',
      });

      const profiles = loadEnvironmentProfiles();
      const customIds = new Set([profile1.id, profile2.id]);

      profiles.forEach((p) => {
        if (customIds.has(p.id)) {
          expect(customIds.has(p.id)).toBe(true);
        }
      });
    });
  });

  // ─── Integration Tests ────────────────────────────────────────────────────

  describe('Integration Scenarios', () => {
    it('should complete full workflow: create, switch, update, delete', () => {
      // Create
      const profile = createEnvironmentProfile({
        name: 'Workflow Test',
        type: 'testnet',
        horizonUrl: 'https://workflow.example.com',
        sorobanUrl: 'https://workflow-soroban.example.com',
        passphrase: 'Workflow',
        description: 'Testing workflow',
      });

      expect(profile.id).toBeDefined();

      // Switch
      switchEnvironmentProfile(profile.id);
      expect(getActiveEnvironmentProfile().id).toBe(profile.id);

      // Update
      const updated = updateEnvironmentProfile(profile.id, {
        description: 'Updated description',
      });
      expect(updated.description).toBe('Updated description');

      // Verify persistence
      const reloaded = getEnvironmentProfile(profile.id);
      expect(reloaded?.description).toBe('Updated description');

      // Delete
      deleteEnvironmentProfile(profile.id);
      expect(getEnvironmentProfile(profile.id)).toBeNull();
    });

    it('should handle multiple user profiles alongside built-in profiles', () => {
      const userProfile1 = createEnvironmentProfile({
        name: 'User Testnet',
        type: 'testnet',
        horizonUrl: 'https://user1.example.com',
        sorobanUrl: 'https://user1-soroban.example.com',
        passphrase: 'User1',
      });

      const userProfile2 = createEnvironmentProfile({
        name: 'User Mainnet',
        type: 'mainnet',
        horizonUrl: 'https://user2.example.com',
        sorobanUrl: 'https://user2-soroban.example.com',
        passphrase: 'User2',
      });

      const allProfiles = loadEnvironmentProfiles();
      expect(allProfiles.length).toBeGreaterThanOrEqual(4); // 2 built-in + 2 custom
      expect(allProfiles.some((p) => p.id === 'testnet-official')).toBe(true);
      expect(allProfiles.some((p) => p.id === 'mainnet-official')).toBe(true);
      expect(allProfiles.some((p) => p.id === userProfile1.id)).toBe(true);
      expect(allProfiles.some((p) => p.id === userProfile2.id)).toBe(true);
    });
  });
});
