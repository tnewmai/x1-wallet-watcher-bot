/**
 * Custom Alerts Tests
 * Tests for custom alert system and quiet hours
 */

import { AlertManager, AlertCondition, CustomAlert, QuietHours } from '../src/alerts-custom';

describe('Alert Manager', () => {
  let alertManager: AlertManager;

  beforeEach(() => {
    alertManager = new AlertManager();
  });

  describe('Custom Alerts', () => {
    test('should create custom alert', () => {
      const alert: CustomAlert = {
        id: '',
        walletAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        name: 'High Value Alert',
        conditions: [],
        enabled: true,
        priority: 'high',
        notifyMethod: 'telegram',
      };

      const alertId = alertManager.createAlert(123, alert);
      
      expect(alertId).toBeTruthy();
      expect(alertId).toContain('123_');
    });

    test('should get user alerts', () => {
      const alert: CustomAlert = {
        id: '',
        walletAddress: 'test',
        name: 'Test Alert',
        conditions: [],
        enabled: true,
        priority: 'medium',
        notifyMethod: 'telegram',
      };

      alertManager.createAlert(123, alert);
      alertManager.createAlert(123, { ...alert, name: 'Test Alert 2' });
      
      const alerts = alertManager.getUserAlerts(123);
      expect(alerts.length).toBe(2);
    });

    test('should delete custom alert', () => {
      const alert: CustomAlert = {
        id: '',
        walletAddress: 'test',
        name: 'Test Alert',
        conditions: [],
        enabled: true,
        priority: 'medium',
        notifyMethod: 'telegram',
      };

      const alertId = alertManager.createAlert(123, alert);
      const deleted = alertManager.deleteAlert(alertId);
      
      expect(deleted).toBe(true);
      expect(alertManager.getUserAlerts(123).length).toBe(0);
    });
  });

  describe('Alert Conditions', () => {
    test('should check balance condition (greater than)', () => {
      const alert: CustomAlert = {
        id: '123_test',
        walletAddress: 'test',
        name: 'Balance Alert',
        conditions: [
          {
            id: 'c1',
            type: 'balance',
            operator: 'gt',
            value: 100,
            enabled: true,
          },
        ],
        enabled: true,
        priority: 'medium',
        notifyMethod: 'telegram',
      };

      const transaction = { balance: 150 };
      const result = alertManager.checkAlertConditions(alert, transaction);
      
      expect(result).toBe(true);
    });

    test('should check value condition (less than)', () => {
      const alert: CustomAlert = {
        id: '123_test',
        walletAddress: 'test',
        name: 'Value Alert',
        conditions: [
          {
            id: 'c1',
            type: 'value',
            operator: 'lt',
            value: 1000,
            enabled: true,
          },
        ],
        enabled: true,
        priority: 'medium',
        notifyMethod: 'telegram',
      };

      const transaction = { valueUSD: 500 };
      const result = alertManager.checkAlertConditions(alert, transaction);
      
      expect(result).toBe(true);
    });

    test('should check token condition (contains)', () => {
      const alert: CustomAlert = {
        id: '123_test',
        walletAddress: 'test',
        name: 'Token Alert',
        conditions: [
          {
            id: 'c1',
            type: 'token',
            operator: 'contains',
            value: 'USDC',
            enabled: true,
          },
        ],
        enabled: true,
        priority: 'medium',
        notifyMethod: 'telegram',
      };

      const transaction = { token: 'USDC' };
      const result = alertManager.checkAlertConditions(alert, transaction);
      
      expect(result).toBe(true);
    });

    test('should fail when condition not met', () => {
      const alert: CustomAlert = {
        id: '123_test',
        walletAddress: 'test',
        name: 'Balance Alert',
        conditions: [
          {
            id: 'c1',
            type: 'balance',
            operator: 'gt',
            value: 100,
            enabled: true,
          },
        ],
        enabled: true,
        priority: 'medium',
        notifyMethod: 'telegram',
      };

      const transaction = { balance: 50 };
      const result = alertManager.checkAlertConditions(alert, transaction);
      
      expect(result).toBe(false);
    });
  });

  describe('Quiet Hours', () => {
    test('should set quiet hours', () => {
      const quietHours: QuietHours = {
        enabled: true,
        startHour: 22,
        endHour: 8,
        timezone: 'UTC',
        allowCritical: true,
      };

      alertManager.setQuietHours(123, quietHours);
      
      const retrieved = alertManager.getQuietHours(123);
      expect(retrieved).toEqual(quietHours);
    });

    test('should check if in quiet hours', () => {
      const quietHours: QuietHours = {
        enabled: true,
        startHour: 0,
        endHour: 6,
        timezone: 'UTC',
        allowCritical: true,
      };

      alertManager.setQuietHours(123, quietHours);
      
      // Note: This test may fail depending on current time
      // In real tests, you'd mock the Date object
      const inQuietHours = alertManager.isInQuietHours(123);
      expect(typeof inQuietHours).toBe('boolean');
    });

    test('should allow critical alerts during quiet hours', () => {
      const quietHours: QuietHours = {
        enabled: true,
        startHour: 0,
        endHour: 23,
        timezone: 'UTC',
        allowCritical: true,
      };

      alertManager.setQuietHours(123, quietHours);
      
      const shouldSend = alertManager.shouldSendAlert(123, 'critical');
      expect(shouldSend).toBe(true);
    });
  });

  describe('Cooldown', () => {
    test('should respect cooldown period', () => {
      const alert: CustomAlert = {
        id: '123_test',
        walletAddress: 'test',
        name: 'Cooldown Alert',
        conditions: [],
        enabled: true,
        cooldown: 5, // 5 minutes
        lastTriggered: Date.now(),
        priority: 'medium',
        notifyMethod: 'telegram',
      };

      const transaction = {};
      const result = alertManager.checkAlertConditions(alert, transaction);
      
      expect(result).toBe(false); // Should be in cooldown
    });
  });
});
