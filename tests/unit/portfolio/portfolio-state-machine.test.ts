import { describe, it, expect } from 'vitest';

/**
 * Portfolio State Machine Tests (TDD: Red-Green-Refactor)
 * 
 * Test state transitions for model portfolios:
 * Draft → Valid → Locked
 * 
 * Acceptance Criteria:
 * - Portfolio starts in Draft state
 * - Draft → Valid allowed only if weights validate
 * - Draft → Draft allowed (edit mode)
 * - Valid → Locked automatic when assigned to account
 * - Valid → Draft allowed (revert for corrections)
 * - Locked portfolios cannot be edited (must clone)
 * - Only locked portfolios can be cloned
 */

type PortfolioStatus = 'Draft' | 'Valid' | 'Locked';

interface Portfolio {
  id: string;
  name: string;
  status: PortfolioStatus;
  clonedFromModelId?: string;
  isWeightValid: boolean;
}

/**
 * Portfolio state machine
 */
class PortfolioStateMachine {
  /**
   * Transition portfolio from Draft to Valid
   * Requires valid weights
   */
  transitionDraftToValid(portfolio: Portfolio): { success: boolean; error?: string } {
    if (portfolio.status !== 'Draft') {
      return {
        success: false,
        error: `Cannot transition from ${portfolio.status} to Valid. Only Draft can transition to Valid.`,
      };
    }

    if (!portfolio.isWeightValid) {
      return {
        success: false,
        error: 'Portfolio weights are invalid. Sum must be 100% ±1%.',
      };
    }

    portfolio.status = 'Valid';
    return { success: true };
  }

  /**
   * Transition portfolio from Valid to Locked
   * Automatic when assigned to account
   */
  transitionValidToLocked(portfolio: Portfolio): { success: boolean; error?: string } {
    if (portfolio.status !== 'Valid') {
      return {
        success: false,
        error: `Cannot transition to Locked from ${portfolio.status}. Only Valid can be locked.`,
      };
    }

    portfolio.status = 'Locked';
    return { success: true };
  }

  /**
   * Transition portfolio from Valid to Draft
   * Allowed for corrections
   */
  transitionValidToDraft(portfolio: Portfolio): { success: boolean; error?: string } {
    if (portfolio.status !== 'Valid') {
      return {
        success: false,
        error: `Cannot transition to Draft from ${portfolio.status}. Only Valid can revert to Draft.`,
      };
    }

    portfolio.status = 'Draft';
    return { success: true };
  }

  /**
   * Transition portfolio from Locked to Valid
   * Only allowed if removed from all accounts (not implemented in MVP)
   */
  transitionLockedToValid(portfolio: Portfolio): { success: boolean; error?: string } {
    if (portfolio.status !== 'Locked') {
      return {
        success: false,
        error: `Cannot transition to Valid from ${portfolio.status}. Only Locked can be unlocked.`,
      };
    }

    // MVP: Not implemented - would require checking account assignments
    return {
      success: false,
      error: 'Unlocking is not supported in this version. Clone the portfolio instead.',
    };
  }

  /**
   * Allow editing in Draft state
   */
  canEdit(portfolio: Portfolio): boolean {
    return portfolio.status === 'Draft';
  }

  /**
   * Allow cloning only locked portfolios
   */
  canClone(portfolio: Portfolio): boolean {
    return portfolio.status === 'Locked';
  }

  /**
   * Clone a locked portfolio to new Draft
   */
  clone(portfolio: Portfolio, newId: string, newName: string): { success: boolean; clone?: Portfolio; error?: string } {
    if (!this.canClone(portfolio)) {
      return {
        success: false,
        error: `Cannot clone portfolio in ${portfolio.status} state. Only Locked portfolios can be cloned.`,
      };
    }

    const clonedPortfolio: Portfolio = {
      id: newId,
      name: newName,
      status: 'Draft',
      clonedFromModelId: portfolio.id,
      isWeightValid: portfolio.isWeightValid,
    };

    return { success: true, clone: clonedPortfolio };
  }
}

describe('Portfolio State Machine - State Transitions', () => {
  const stateMachine = new PortfolioStateMachine();

  describe('Draft State', () => {
    it('should create portfolio in Draft state', () => {
      const portfolio: Portfolio = {
        id: 'pm-001',
        name: 'Test Portfolio',
        status: 'Draft',
        isWeightValid: false,
      };

      expect(portfolio.status).toBe('Draft');
    });

    it('should allow editing in Draft state', () => {
      const portfolio: Portfolio = {
        id: 'pm-001',
        name: 'Test Portfolio',
        status: 'Draft',
        isWeightValid: false,
      };

      expect(stateMachine.canEdit(portfolio)).toBe(true);
    });

    it('should not allow cloning Draft portfolio', () => {
      const portfolio: Portfolio = {
        id: 'pm-001',
        name: 'Test Portfolio',
        status: 'Draft',
        isWeightValid: false,
      };

      expect(stateMachine.canClone(portfolio)).toBe(false);
    });
  });

  describe('Draft → Valid Transition', () => {
    it('should transition from Draft to Valid with valid weights', () => {
      const portfolio: Portfolio = {
        id: 'pm-001',
        name: 'Valid Portfolio',
        status: 'Draft',
        isWeightValid: true,
      };

      const result = stateMachine.transitionDraftToValid(portfolio);

      expect(result.success).toBe(true);
      expect(portfolio.status).toBe('Valid');
    });

    it('should reject Draft → Valid with invalid weights', () => {
      const portfolio: Portfolio = {
        id: 'pm-002',
        name: 'Invalid Portfolio',
        status: 'Draft',
        isWeightValid: false,
      };

      const result = stateMachine.transitionDraftToValid(portfolio);

      expect(result.success).toBe(false);
      expect(result.error).toContain('weights are invalid');
      expect(portfolio.status).toBe('Draft'); // State unchanged
    });

    it('should not allow Draft → Valid from non-Draft state', () => {
      const portfolio: Portfolio = {
        id: 'pm-003',
        name: 'Already Valid',
        status: 'Valid',
        isWeightValid: true,
      };

      const result = stateMachine.transitionDraftToValid(portfolio);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Only Draft can transition to Valid');
    });
  });

  describe('Valid State', () => {
    it('should not allow editing in Valid state', () => {
      const portfolio: Portfolio = {
        id: 'pm-004',
        name: 'Valid Portfolio',
        status: 'Valid',
        isWeightValid: true,
      };

      expect(stateMachine.canEdit(portfolio)).toBe(false);
    });

    it('should not allow cloning Valid portfolio (only Locked)', () => {
      const portfolio: Portfolio = {
        id: 'pm-004',
        name: 'Valid Portfolio',
        status: 'Valid',
        isWeightValid: true,
      };

      expect(stateMachine.canClone(portfolio)).toBe(false);
    });
  });

  describe('Valid → Locked Transition', () => {
    it('should transition from Valid to Locked when assigned to account', () => {
      const portfolio: Portfolio = {
        id: 'pm-005',
        name: 'Ready to Lock',
        status: 'Valid',
        isWeightValid: true,
      };

      const result = stateMachine.transitionValidToLocked(portfolio);

      expect(result.success).toBe(true);
      expect(portfolio.status).toBe('Locked');
    });

    it('should not allow Valid → Locked from non-Valid state', () => {
      const portfolio: Portfolio = {
        id: 'pm-006',
        name: 'Already Draft',
        status: 'Draft',
        isWeightValid: true,
      };

      const result = stateMachine.transitionValidToLocked(portfolio);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Only Valid can be locked');
    });

    it('should not allow Valid → Locked for Locked portfolio', () => {
      const portfolio: Portfolio = {
        id: 'pm-007',
        name: 'Already Locked',
        status: 'Locked',
        isWeightValid: true,
      };

      const result = stateMachine.transitionValidToLocked(portfolio);

      expect(result.success).toBe(false);
    });
  });

  describe('Locked State', () => {
    it('should not allow editing in Locked state', () => {
      const portfolio: Portfolio = {
        id: 'pm-008',
        name: 'Locked Portfolio',
        status: 'Locked',
        isWeightValid: true,
      };

      expect(stateMachine.canEdit(portfolio)).toBe(false);
    });

    it('should allow cloning Locked portfolio', () => {
      const portfolio: Portfolio = {
        id: 'pm-008',
        name: 'Locked Portfolio',
        status: 'Locked',
        isWeightValid: true,
      };

      expect(stateMachine.canClone(portfolio)).toBe(true);
    });
  });

  describe('Valid → Draft Revert', () => {
    it('should allow reverting from Valid to Draft for corrections', () => {
      const portfolio: Portfolio = {
        id: 'pm-009',
        name: 'Needs Correction',
        status: 'Valid',
        isWeightValid: true,
      };

      const result = stateMachine.transitionValidToDraft(portfolio);

      expect(result.success).toBe(true);
      expect(portfolio.status).toBe('Draft');
    });

    it('should not allow revert from Draft to Valid to Draft (only Valid can revert)', () => {
      const portfolio: Portfolio = {
        id: 'pm-010',
        name: 'In Draft',
        status: 'Draft',
        isWeightValid: true,
      };

      const result = stateMachine.transitionValidToDraft(portfolio);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Only Valid can revert to Draft');
    });

    it('should not allow revert from Locked', () => {
      const portfolio: Portfolio = {
        id: 'pm-011',
        name: 'Locked',
        status: 'Locked',
        isWeightValid: true,
      };

      const result = stateMachine.transitionValidToDraft(portfolio);

      expect(result.success).toBe(false);
    });
  });

  describe('Locked → Valid Unlock (Not Implemented)', () => {
    it('should reject unlock attempt (not implemented in MVP)', () => {
      const portfolio: Portfolio = {
        id: 'pm-012',
        name: 'Locked Portfolio',
        status: 'Locked',
        isWeightValid: true,
      };

      const result = stateMachine.transitionLockedToValid(portfolio);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not supported');
    });
  });

  describe('Portfolio Cloning', () => {
    it('should clone Locked portfolio to new Draft', () => {
      const portfolio: Portfolio = {
        id: 'pm-013',
        name: 'Original Locked',
        status: 'Locked',
        isWeightValid: true,
      };

      const result = stateMachine.clone(portfolio, 'pm-014', 'Clone of Original');

      expect(result.success).toBe(true);
      expect(result.clone).toBeDefined();
      expect(result.clone!.status).toBe('Draft');
      expect(result.clone!.clonedFromModelId).toBe(portfolio.id);
      expect(result.clone!.name).toBe('Clone of Original');
    });

    it('should not clone Draft portfolio', () => {
      const portfolio: Portfolio = {
        id: 'pm-015',
        name: 'Draft Portfolio',
        status: 'Draft',
        isWeightValid: false,
      };

      const result = stateMachine.clone(portfolio, 'pm-016', 'Clone');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Only Locked portfolios can be cloned');
    });

    it('should not clone Valid portfolio', () => {
      const portfolio: Portfolio = {
        id: 'pm-017',
        name: 'Valid Portfolio',
        status: 'Valid',
        isWeightValid: true,
      };

      const result = stateMachine.clone(portfolio, 'pm-018', 'Clone');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Only Locked portfolios can be cloned');
    });

    it('should preserve weight validity in clone', () => {
      const portfolio: Portfolio = {
        id: 'pm-019',
        name: 'Locked with Valid Weights',
        status: 'Locked',
        isWeightValid: true,
      };

      const result = stateMachine.clone(portfolio, 'pm-020', 'Clone');

      expect(result.clone!.isWeightValid).toBe(portfolio.isWeightValid);
    });

    it('should generate unique clone ID', () => {
      const portfolio: Portfolio = {
        id: 'pm-021',
        name: 'Original',
        status: 'Locked',
        isWeightValid: true,
      };

      const result = stateMachine.clone(portfolio, 'pm-unique-clone', 'Unique Clone');

      expect(result.clone!.id).toBe('pm-unique-clone');
      expect(result.clone!.id).not.toBe(portfolio.id);
    });
  });

  describe('Full State Machine Workflow', () => {
    it('should complete full workflow: Draft → Valid → Locked → Clone', () => {
      // Step 1: Create Draft
      const portfolio: Portfolio = {
        id: 'pm-workflow-1',
        name: 'Workflow Portfolio',
        status: 'Draft',
        isWeightValid: false,
      };

      expect(portfolio.status).toBe('Draft');
      expect(stateMachine.canEdit(portfolio)).toBe(true);

      // Step 2: Edit in Draft (simulate)
      portfolio.isWeightValid = true;

      // Step 3: Transition to Valid
      let result = stateMachine.transitionDraftToValid(portfolio);
      expect(result.success).toBe(true);
      expect(portfolio.status).toBe('Valid');

      // Step 4: Cannot edit in Valid
      expect(stateMachine.canEdit(portfolio)).toBe(false);

      // Step 5: Assign to account → transition to Locked
      result = stateMachine.transitionValidToLocked(portfolio);
      expect(result.success).toBe(true);
      expect(portfolio.status).toBe('Locked');

      // Step 6: Clone locked portfolio
      const cloneResult = stateMachine.clone(portfolio, 'pm-workflow-clone', 'Cloned Workflow');
      expect(cloneResult.success).toBe(true);
      expect(cloneResult.clone!.status).toBe('Draft');
      expect(cloneResult.clone!.clonedFromModelId).toBe(portfolio.id);
    });

    it('should allow revert from Valid for weight corrections', () => {
      const portfolio: Portfolio = {
        id: 'pm-revert-1',
        name: 'Needs Revert',
        status: 'Draft',
        isWeightValid: true,
      };

      // Draft → Valid
      stateMachine.transitionDraftToValid(portfolio);
      expect(portfolio.status).toBe('Valid');

      // Valid → Draft for corrections
      const revertResult = stateMachine.transitionValidToDraft(portfolio);
      expect(revertResult.success).toBe(true);
      expect(portfolio.status).toBe('Draft');

      // Edit weights (simulate invalid)
      portfolio.isWeightValid = false;

      // Can stay in Draft or transition back to Valid with corrected weights
      portfolio.isWeightValid = true;
      const validResult = stateMachine.transitionDraftToValid(portfolio);
      expect(validResult.success).toBe(true);
      expect(portfolio.status).toBe('Valid');
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple clone operations', () => {
      const original: Portfolio = {
        id: 'pm-original',
        name: 'Original',
        status: 'Locked',
        isWeightValid: true,
      };

      const clone1Result = stateMachine.clone(original, 'pm-clone-1', 'Clone 1');
      expect(clone1Result.success).toBe(true);

      const clone2Result = stateMachine.clone(original, 'pm-clone-2', 'Clone 2');
      expect(clone2Result.success).toBe(true);

      expect(clone1Result.clone!.id).not.toBe(clone2Result.clone!.id);
      expect(clone1Result.clone!.clonedFromModelId).toBe(clone2Result.clone!.clonedFromModelId);
    });

    it('should allow cloning a clone', () => {
      const original: Portfolio = {
        id: 'pm-original',
        name: 'Original',
        status: 'Locked',
        isWeightValid: true,
      };

      const cloneResult = stateMachine.clone(original, 'pm-clone-1', 'Clone 1');
      expect(cloneResult.success).toBe(true);

      // Move clone to Locked state (simulate assignment)
      const clone = cloneResult.clone!;
      clone.status = 'Locked';

      // Clone the clone
      const cloneOfCloneResult = stateMachine.clone(clone, 'pm-clone-2', 'Clone of Clone');
      expect(cloneOfCloneResult.success).toBe(true);
      expect(cloneOfCloneResult.clone!.clonedFromModelId).toBe(clone.id);
    });
  });
});
