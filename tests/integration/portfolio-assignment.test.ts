import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { allAsync, runAsync, closeDatabase } from '@/backend/db/database';
import { accountService } from '@/backend/services/account.service';
import { v4 as uuid } from 'uuid';

/**
 * Integration Tests: Portfolio Assignment (User Story 3)
 * 
 * Tests User Story 3 acceptance scenarios:
 * 1. User can view linked accounts from Schwab
 * 2. User can select and assign valid model to account
 * 3. Assignment locks the model (prevents editing)
 * 4. User can reassign account to different model
 * 5. Previous model remains locked after reassignment
 */
describe('Portfolio Assignment (User Story 3)', () => {
  let accountId: string;
  let modelId1: string;
  let modelId2: string;

  beforeEach(async () => {
    // Create test data: accounts and models
    accountId = uuid();
    modelId1 = uuid();
    modelId2 = uuid();

    // Create models in Valid state
    await runAsync(
      `
      INSERT INTO model_portfolio (id, name, description, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      [modelId1, 'Test Model 1', 'First test model', 'Valid', new Date().toISOString(), new Date().toISOString()]
    );

    await runAsync(
      `
      INSERT INTO model_portfolio (id, name, description, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      [modelId2, 'Test Model 2', 'Second test model', 'Valid', new Date().toISOString(), new Date().toISOString()]
    );

    // Create test account
    await runAsync(
      `
      INSERT INTO account (id, schwabEncryptedAccountId, nickname, createdAt)
      VALUES (?, ?, ?, ?)
    `,
      [accountId, '[encrypted:TEST123]', 'Test Account', new Date().toISOString()]
    );
  });

  afterEach(async () => {
    // Cleanup
    await runAsync('DELETE FROM account WHERE id = ?', [accountId]);
    await runAsync('DELETE FROM model_portfolio WHERE id IN (?, ?)', [modelId1, modelId2]);
    await runAsync('DELETE FROM audit_log_entry WHERE accountId = ?', [accountId]);
    await closeDatabase();
  });

  it('Scenario 1: User can view linked accounts', async () => {
    // When: User retrieves all accounts
    const accounts = await accountService.getAllAccounts();

    // Then: Account should be in the list
    expect(accounts).toBeDefined();
    expect(Array.isArray(accounts)).toBe(true);

    const testAccount = accounts.find((a) => a.id === accountId);
    expect(testAccount).toBeDefined();
    expect(testAccount?.nickname).toBe('Test Account');
    expect(testAccount?.assignedModelPortfolioId).toBeNull();
  });

  it('Scenario 2: User can assign valid model to account', async () => {
    // When: User assigns valid model to account
    const updated = await accountService.assignModelToAccount(accountId, modelId1);

    // Then: Account should have model assigned
    expect(updated.id).toBe(accountId);
    expect(updated.assignedModelPortfolioId).toBe(modelId1);
    expect(updated.assignedModelPortfolioName).toBe('Test Model 1');

    // And: Audit log should record the assignment
    const auditLog = await allAsync<{ action: string; accountId: string }>(
      `SELECT action, accountId FROM audit_log_entry WHERE accountId = ?`,
      [accountId]
    );
    expect(auditLog.length).toBeGreaterThan(0);
    expect(auditLog[0].action).toBe('MODEL_ASSIGNED');
  });

  it('Scenario 3: Assignment locks the model (prevents editing)', async () => {
    // Given: User has assigned model to account
    await accountService.assignModelToAccount(accountId, modelId1);

    // When: Check model status
    const model = await allAsync<{ status: string }>(
      `SELECT status FROM model_portfolio WHERE id = ?`,
      [modelId1]
    );

    // Then: Model should be Locked
    expect(model).toHaveLength(1);
    expect(model[0].status).toBe('Locked');
  });

  it('Scenario 4: User can reassign account to different model', async () => {
    // Given: Account is assigned to model 1
    await accountService.assignModelToAccount(accountId, modelId1);

    // When: User reassigns to model 2
    const updated = await accountService.reassignModel(accountId, modelId2);

    // Then: Account should now reference model 2
    expect(updated.assignedModelPortfolioId).toBe(modelId2);
    expect(updated.assignedModelPortfolioName).toBe('Test Model 2');

    // And: audit log should record reassignment
    const auditLog = await allAsync<{ action: string }>(
      `SELECT action FROM audit_log_entry WHERE accountId = ? AND action = 'MODEL_REASSIGNED'`,
      [accountId]
    );
    expect(auditLog.length).toBeGreaterThan(0);
  });

  it('Scenario 5: Previous model remains locked after reassignment', async () => {
    // Given: Account assigned to model 1, then reassigned to model 2
    await accountService.assignModelToAccount(accountId, modelId1);
    await accountService.reassignModel(accountId, modelId2);

    // When: Check both model statuses
    const models = await allAsync<{ id: string; status: string }>(
      `SELECT id, status FROM model_portfolio WHERE id IN (?, ?)`,
      [modelId1, modelId2]
    );

    // Then: Both should be Locked (previous remains locked)
    const model1 = models.find((m) => m.id === modelId1);
    const model2 = models.find((m) => m.id === modelId2);

    expect(model1?.status).toBe('Locked');
    expect(model2?.status).toBe('Locked');
  });

  it('Should prevent assigning non-Valid models', async () => {
    // Given: A Draft model
    const draftModelId = uuid();
    await runAsync(
      `
      INSERT INTO model_portfolio (id, name, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?)
    `,
      [draftModelId, 'Draft Model', 'Draft', new Date().toISOString(), new Date().toISOString()]
    );

    // When/Then: Should throw error trying to assign
    try {
      await accountService.assignModelToAccount(accountId, draftModelId);
      expect.fail('Should have thrown error');
    } catch (error) {
      expect(error instanceof Error).toBe(true);
      expect((error as Error).message).toContain('Cannot assign model in Draft state');
    }

    // Cleanup
    await runAsync('DELETE FROM model_portfolio WHERE id = ?', [draftModelId]);
  });

  it('Should handle account not found', async () => {
    // When/Then: Should throw error for non-existent account
    try {
      await accountService.assignModelToAccount(uuid(), modelId1);
      expect.fail('Should have thrown error');
    } catch (error) {
      expect(error instanceof Error).toBe(true);
      expect((error as Error).message).toContain('not found');
    }
  });

  it('Should handle model not found', async () => {
    // When/Then: Should throw error for non-existent model
    try {
      await accountService.assignModelToAccount(accountId, uuid());
      expect.fail('Should have thrown error');
    } catch (error) {
      expect(error instanceof Error).toBe(true);
      expect((error as Error).message).toContain('not found');
    }
  });

  it('Can get account details with assignment', async () => {
    // Given: Account assigned to model
    await accountService.assignModelToAccount(accountId, modelId1);

    // When: Retrieve account details
    const details = await accountService.getAccountById(accountId);

    // Then: Should return account with assignment
    expect(details.id).toBe(accountId);
    expect(details.assignedModelPortfolioId).toBe(modelId1);
    expect(details.nickname).toBe('Test Account');
    expect(Array.isArray(details.positions)).toBe(true);
  });

  it('Can unassign model from account', async () => {
    // Given: Account assigned to model
    await accountService.assignModelToAccount(accountId, modelId1);

    // When: Unassign model
    const updated = await accountService.unassignModel(accountId);

    // Then: Account should no longer have model
    expect(updated.assignedModelPortfolioId).toBeNull();
  });

  it('Can update account nickname', async () => {
    // When: Update nickname
    const updated = await accountService.updateAccountNickname(accountId, 'New Nickname');

    // Then: Nickname should be updated
    expect(updated.nickname).toBe('New Nickname');

    // And: Verify in database
    const verified = await accountService.getAccountById(accountId);
    expect(verified.nickname).toBe('New Nickname');
  });
});
