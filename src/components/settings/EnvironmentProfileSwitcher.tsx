/**
 * Environment Profile Switcher Component
 * Allows users to switch between Testnet, Mainnet, and custom profiles
 */

import React, { useState } from 'react';
import { useEnvironmentProfiles } from '../../hooks/useEnvironmentProfiles';
import type { EnvironmentProfile } from '../../lib/environmentProfiles';
import './EnvironmentProfileSwitcher.css';

interface EnvironmentProfileSwitcherProps {
  onProfileChange?: (profile: EnvironmentProfile) => void;
}

export const EnvironmentProfileSwitcher: React.FC<EnvironmentProfileSwitcherProps> = ({
  onProfileChange,
}) => {
  const { profiles, activeProfile, loading, error, switchProfile } = useEnvironmentProfiles();
  const [isOpen, setIsOpen] = useState(false);

  const handleProfileSelect = (profileId: string) => {
    try {
      switchProfile(profileId);
      setIsOpen(false);

      // Call the callback if provided
      const selected = profiles.find((p) => p.id === profileId);
      if (selected && onProfileChange) {
        onProfileChange(selected);
      }
    } catch (err) {
      console.error('Failed to switch profile:', err);
    }
  };

  if (loading) {
    return (
      <div className="env-profile-switcher loading">
        <span>Loading profiles...</span>
      </div>
    );
  }

  if (!activeProfile) {
    return (
      <div className="env-profile-switcher error">
        <span>No profile selected</span>
      </div>
    );
  }

  // Group profiles by type
  const testnetProfiles = profiles.filter((p) => p.type === 'testnet');
  const mainnetProfiles = profiles.filter((p) => p.type === 'mainnet');

  return (
    <div className="env-profile-switcher">
      <button
        className={`profile-button ${activeProfile.type}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Switch environment profile"
        title={`Current: ${activeProfile.name}`}
      >
        <span className="profile-icon" />
        <span className="profile-name">{activeProfile.name}</span>
        <span className={`chevron ${isOpen ? 'open' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div className="profile-dropdown">
          {error && <div className="profile-error">{error}</div>}

          {testnetProfiles.length > 0 && (
            <>
              <div className="profile-group-label">Testnet</div>
              {testnetProfiles.map((profile) => (
                <button
                  key={profile.id}
                  className={`profile-option ${activeProfile.id === profile.id ? 'active' : ''}`}
                  onClick={() => handleProfileSelect(profile.id)}
                  disabled={activeProfile.id === profile.id}
                >
                  <span className="profile-name">{profile.name}</span>
                  {profile.description && (
                    <span className="profile-description">{profile.description}</span>
                  )}
                </button>
              ))}
            </>
          )}

          {mainnetProfiles.length > 0 && (
            <>
              <div className="profile-group-label mainnet">Mainnet</div>
              {mainnetProfiles.map((profile) => (
                <button
                  key={profile.id}
                  className={`profile-option mainnet ${activeProfile.id === profile.id ? 'active' : ''}`}
                  onClick={() => handleProfileSelect(profile.id)}
                  disabled={activeProfile.id === profile.id}
                >
                  <span className="profile-name">{profile.name}</span>
                  {profile.description && (
                    <span className="profile-description">{profile.description}</span>
                  )}
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* Close dropdown when clicking outside */}
      {isOpen && (
        <div
          className="profile-dropdown-backdrop"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export default EnvironmentProfileSwitcher;
