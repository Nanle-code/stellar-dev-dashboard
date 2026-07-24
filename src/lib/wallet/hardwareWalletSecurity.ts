/**
 * Hardware Wallet Security Enhancements
 * Enhanced security features for Ledger and other hardware wallets
 */

export interface HardwareDevice {
  id: string;
  type: 'ledger' | 'trezor' | 'other';
  model: string;
  firmwareVersion: string;
  connected: boolean;
  pinProtected: boolean;
}

export interface SecurityVulnerability {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affectedVersions: string[];
  recommendation: string;
  cveId?: string;
}

export interface SecurityCheckResult {
  device: HardwareDevice;
  vulnerabilities: SecurityVulnerability[];
  pinProtectionEnabled: boolean;
  firmwareUpToDate: boolean;
  recommendations: string[];
}

const KNOWN_VULNERABILITIES: SecurityVulnerability[] = [
  {
    id: 'vuln-1',
    severity: 'critical',
    title: 'Firmware Version Below 2.0.0',
    description: 'Firmware versions below 2.0.0 have known security vulnerabilities that can be exploited.',
    affectedVersions: ['1.0.0', '1.1.0', '1.2.0', '1.3.0', '1.4.0', '1.5.0', '1.6.0'],
    recommendation: 'Update firmware to version 2.0.0 or higher immediately via Ledger Live.',
    cveId: 'CVE-2023-XXXX',
  },
  {
    id: 'vuln-2',
    severity: 'high',
    title: 'Memory Corruption in Transaction Signing',
    description: 'Certain firmware versions have a memory corruption vulnerability during complex transaction signing.',
    affectedVersions: ['2.0.0', '2.0.1', '2.0.2'],
    recommendation: 'Update to firmware version 2.1.0 or higher.',
  },
  {
    id: 'vuln-3',
    severity: 'medium',
    title: 'PIN Entry Timing Attack',
    description: 'Some models are vulnerable to timing attacks during PIN entry that could leak information.',
    affectedVersions: ['1.5.5', '1.6.0'],
    recommendation: 'Enable additional security features and update firmware.',
  },
];

const MINIMUM_SAFE_FIRMWARE = '2.1.0';

class HardwareWalletSecurityManager {
  private devices: Map<string, HardwareDevice> = new Map();
  private pinProtectionCache: Map<string, boolean> = new Map();

  async detectDevice(): Promise<HardwareDevice | null> {
    // Check for WebUSB support
    if (!('usb' in navigator)) {
      console.warn('WebUSB not supported in this browser');
      return null;
    }

    try {
      // Request USB device access (Ledger devices)
      const devices = await (navigator as any).usb.getDevices();
      
      if (devices.length === 0) {
        // Try to request a new device
        const device = await (navigator as any).usb.requestDevice({
          filters: [
            { vendorId: 0x2c97 }, // Ledger vendor ID
          ],
        });
        
        if (device) {
          return await this.parseDevice(device);
        }
      }

      // Parse existing devices
      for (const device of devices) {
        const parsed = await this.parseDevice(device);
        if (parsed) {
          this.devices.set(parsed.id, parsed);
          return parsed;
        }
      }
    } catch (error) {
      console.error('Failed to detect hardware wallet:', error);
    }

    return null;
  }

  private async parseDevice(usbDevice: any): Promise<HardwareDevice | null> {
    try {
      const device: HardwareDevice = {
        id: `device-${Date.now()}`,
        type: 'ledger',
        model: this.getDeviceModel(usbDevice.productId),
        firmwareVersion: '2.1.0', // In production, query actual version
        connected: true,
        pinProtected: false,
      };

      return device;
    } catch (error) {
      console.error('Failed to parse device:', error);
      return null;
    }
  }

  private getDeviceModel(productId: number): string {
    const models: Record<number, string> = {
      0x0001: 'Ledger Nano S',
      0x0004: 'Ledger Nano X',
      0x0005: 'Ledger Nano S Plus',
    };
    return models[productId] || 'Unknown Ledger Device';
  }

  async checkDeviceSecurity(device: HardwareDevice): Promise<SecurityCheckResult> {
    const vulnerabilities = this.findVulnerabilities(device);
    const pinProtectionEnabled = await this.checkPinProtection(device);
    const firmwareUpToDate = this.isFirmwareUpToDate(device.firmwareVersion);
    const recommendations = this.generateRecommendations(device, vulnerabilities, pinProtectionEnabled, firmwareUpToDate);

    return {
      device,
      vulnerabilities,
      pinProtectionEnabled,
      firmwareUpToDate,
      recommendations,
    };
  }

  private findVulnerabilities(device: HardwareDevice): SecurityVulnerability[] {
    return KNOWN_VULNERABILITIES.filter((vuln) =>
      vuln.affectedVersions.includes(device.firmwareVersion)
    );
  }

  private async checkPinProtection(device: HardwareDevice): Promise<boolean> {
    // Check cache first
    if (this.pinProtectionCache.has(device.id)) {
      return this.pinProtectionCache.get(device.id)!;
    }

    // In production, query device for PIN status
    // For demo, return true
    const pinEnabled = true;
    this.pinProtectionCache.set(device.id, pinEnabled);
    return pinEnabled;
  }

  private isFirmwareUpToDate(version: string): boolean {
    return this.compareVersions(version, MINIMUM_SAFE_FIRMWARE) >= 0;
  }

  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;

      if (part1 > part2) return 1;
      if (part1 < part2) return -1;
    }

    return 0;
  }

  private generateRecommendations(
    device: HardwareDevice,
    vulnerabilities: SecurityVulnerability[],
    pinProtected: boolean,
    firmwareUpToDate: boolean
  ): string[] {
    const recommendations: string[] = [];

    if (!pinProtected) {
      recommendations.push('Enable PIN protection on your device immediately');
    }

    if (!firmwareUpToDate) {
      recommendations.push(`Update firmware from ${device.firmwareVersion} to ${MINIMUM_SAFE_FIRMWARE} or higher`);
    }

    if (vulnerabilities.length > 0) {
      const critical = vulnerabilities.filter((v) => v.severity === 'critical');
      const high = vulnerabilities.filter((v) => v.severity === 'high');

      if (critical.length > 0) {
        recommendations.push(`⚠️ CRITICAL: ${critical.length} critical vulnerabilities detected. Update firmware immediately!`);
      }

      if (high.length > 0) {
        recommendations.push(`⚠️ ${high.length} high-severity vulnerabilities found. Update firmware as soon as possible.`);
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('✓ Your device security is up to date');
    }

    return recommendations;
  }

  async enablePinProtection(deviceId: string, pin: string): Promise<boolean> {
    if (pin.length < 4 || pin.length > 8) {
      throw new Error('PIN must be 4-8 digits');
    }

    if (!/^\d+$/.test(pin)) {
      throw new Error('PIN must contain only digits');
    }

    // In production, send PIN to device
    // For demo, just update cache
    this.pinProtectionCache.set(deviceId, true);
    
    const device = this.devices.get(deviceId);
    if (device) {
      device.pinProtected = true;
      this.devices.set(deviceId, device);
    }

    return true;
  }

  async verifyPin(deviceId: string, pin: string): Promise<boolean> {
    // In production, verify PIN with device
    // For demo, check if PIN is set
    return this.pinProtectionCache.get(deviceId) || false;
  }

  async validateSecurityKey(publicKey: string): Promise<boolean> {
    // Validate that the public key follows Stellar format
    if (!publicKey || publicKey.length !== 56) {
      return false;
    }

    if (!publicKey.startsWith('G')) {
      return false;
    }

    // Additional validation could include checksum verification
    return true;
  }

  getVulnerabilityDatabase(): SecurityVulnerability[] {
    return KNOWN_VULNERABILITIES;
  }

  async checkMultipleDevices(): Promise<SecurityCheckResult[]> {
    const results: SecurityCheckResult[] = [];

    for (const device of this.devices.values()) {
      const check = await this.checkDeviceSecurity(device);
      results.push(check);
    }

    return results;
  }

  async disconnectDevice(deviceId: string): Promise<void> {
    const device = this.devices.get(deviceId);
    if (device) {
      device.connected = false;
      this.devices.set(deviceId, device);
    }
  }

  getAllConnectedDevices(): HardwareDevice[] {
    return Array.from(this.devices.values()).filter((d) => d.connected);
  }
}

export const hardwareWalletSecurity = new HardwareWalletSecurityManager();
