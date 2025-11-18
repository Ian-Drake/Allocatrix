/**
 * Unit tests for BulkActionBar component
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BulkActionBar } from '../../../../src/features/portfolio-dashboard/components/BulkActionBar/BulkActionBar';

describe('BulkActionBar', () => {
  it('should render with no selection', () => {
    render(
      <BulkActionBar
        selectedCount={0}
        onLiquidate={vi.fn()}
        onRebalance={vi.fn()}
        onUseCash={vi.fn()}
        isEnabled={false}
      />
    );

    expect(screen.getByText('No accounts selected')).toBeInTheDocument();
  });

  it('should display selected count (singular)', () => {
    render(
      <BulkActionBar
        selectedCount={1}
        onLiquidate={vi.fn()}
        onRebalance={vi.fn()}
        onUseCash={vi.fn()}
        isEnabled={true}
      />
    );

    expect(screen.getByText('1 account selected')).toBeInTheDocument();
  });

  it('should display selected count (plural)', () => {
    render(
      <BulkActionBar
        selectedCount={3}
        onLiquidate={vi.fn()}
        onRebalance={vi.fn()}
        onUseCash={vi.fn()}
        isEnabled={true}
      />
    );

    expect(screen.getByText('3 accounts selected')).toBeInTheDocument();
  });

  it('should render all three action buttons', () => {
    render(
      <BulkActionBar
        selectedCount={1}
        onLiquidate={vi.fn()}
        onRebalance={vi.fn()}
        onUseCash={vi.fn()}
        isEnabled={true}
      />
    );

    expect(screen.getByText('Liquidate')).toBeInTheDocument();
    expect(screen.getByText('Rebalance')).toBeInTheDocument();
    expect(screen.getByText('Use Cash')).toBeInTheDocument();
  });

  it('should disable buttons when isEnabled is false', () => {
    render(
      <BulkActionBar
        selectedCount={0}
        onLiquidate={vi.fn()}
        onRebalance={vi.fn()}
        onUseCash={vi.fn()}
        isEnabled={false}
      />
    );

    const liquidateBtn = screen.getByLabelText('Liquidate selected accounts');
    const rebalanceBtn = screen.getByLabelText('Rebalance selected accounts');
    const useCashBtn = screen.getByLabelText('Use cash in selected accounts');

    expect(liquidateBtn).toBeDisabled();
    expect(rebalanceBtn).toBeDisabled();
    expect(useCashBtn).toBeDisabled();
  });

  it('should enable buttons when isEnabled is true', () => {
    render(
      <BulkActionBar
        selectedCount={2}
        onLiquidate={vi.fn()}
        onRebalance={vi.fn()}
        onUseCash={vi.fn()}
        isEnabled={true}
      />
    );

    const liquidateBtn = screen.getByLabelText('Liquidate selected accounts');
    const rebalanceBtn = screen.getByLabelText('Rebalance selected accounts');
    const useCashBtn = screen.getByLabelText('Use cash in selected accounts');

    expect(liquidateBtn).not.toBeDisabled();
    expect(rebalanceBtn).not.toBeDisabled();
    expect(useCashBtn).not.toBeDisabled();
  });

  it('should call onLiquidate when Liquidate button is clicked', () => {
    const onLiquidate = vi.fn();

    render(
      <BulkActionBar
        selectedCount={1}
        onLiquidate={onLiquidate}
        onRebalance={vi.fn()}
        onUseCash={vi.fn()}
        isEnabled={true}
      />
    );

    const liquidateBtn = screen.getByLabelText('Liquidate selected accounts');
    fireEvent.click(liquidateBtn);

    expect(onLiquidate).toHaveBeenCalledTimes(1);
  });

  it('should call onRebalance when Rebalance button is clicked', () => {
    const onRebalance = vi.fn();

    render(
      <BulkActionBar
        selectedCount={1}
        onLiquidate={vi.fn()}
        onRebalance={onRebalance}
        onUseCash={vi.fn()}
        isEnabled={true}
      />
    );

    const rebalanceBtn = screen.getByLabelText('Rebalance selected accounts');
    fireEvent.click(rebalanceBtn);

    expect(onRebalance).toHaveBeenCalledTimes(1);
  });

  it('should call onUseCash when Use Cash button is clicked', () => {
    const onUseCash = vi.fn();

    render(
      <BulkActionBar
        selectedCount={1}
        onLiquidate={vi.fn()}
        onRebalance={vi.fn()}
        onUseCash={onUseCash}
        isEnabled={true}
      />
    );

    const useCashBtn = screen.getByLabelText('Use cash in selected accounts');
    fireEvent.click(useCashBtn);

    expect(onUseCash).toHaveBeenCalledTimes(1);
  });

  it('should not call handlers when buttons are disabled', () => {
    const onLiquidate = vi.fn();
    const onRebalance = vi.fn();
    const onUseCash = vi.fn();

    render(
      <BulkActionBar
        selectedCount={0}
        onLiquidate={onLiquidate}
        onRebalance={onRebalance}
        onUseCash={onUseCash}
        isEnabled={false}
      />
    );

    const liquidateBtn = screen.getByLabelText('Liquidate selected accounts');
    const rebalanceBtn = screen.getByLabelText('Rebalance selected accounts');
    const useCashBtn = screen.getByLabelText('Use cash in selected accounts');

    fireEvent.click(liquidateBtn);
    fireEvent.click(rebalanceBtn);
    fireEvent.click(useCashBtn);

    expect(onLiquidate).not.toHaveBeenCalled();
    expect(onRebalance).not.toHaveBeenCalled();
    expect(onUseCash).not.toHaveBeenCalled();
  });
});
