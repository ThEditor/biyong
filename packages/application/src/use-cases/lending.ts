import {
  applyRepayment,
  calculatePeerDebtSummary,
  type PeerDebtSummary,
} from '@biyong/domain';
import type { PeerDebt, PeerDebtRepayment } from '@biyong/schemas';
import type { PeerDebtRepository } from '../repositories.js';

export class LendingUseCases {
  constructor(private peerDebtRepo: PeerDebtRepository) {}

  async createPeerDebt(debt: PeerDebt): Promise<void> {
    if (this.peerDebtRepo.save) {
      await this.peerDebtRepo.save(debt);
    } else if (this.peerDebtRepo.create) {
      await this.peerDebtRepo.create(debt);
    }
  }

  async savePeerDebt(debt: PeerDebt): Promise<void> {
    if (this.peerDebtRepo.save) {
      await this.peerDebtRepo.save(debt);
    } else if (this.peerDebtRepo.update) {
      await this.peerDebtRepo.update(debt);
    }
  }

  async getPeerDebt(id: string): Promise<PeerDebt | null> {
    return this.peerDebtRepo.findById(id);
  }

  async listPeerDebts(): Promise<PeerDebt[]> {
    return this.peerDebtRepo.findAll();
  }

  async deletePeerDebt(id: string): Promise<void> {
    return this.peerDebtRepo.delete(id);
  }

  async recordRepayment(
    debtId: string,
    amountMinor: number,
    notes?: string
  ): Promise<{
    updatedDebt: PeerDebt;
    repayment: PeerDebtRepayment;
    actualPaymentMinor: number;
    isSettled: boolean;
  }> {
    const debt = await this.peerDebtRepo.findById(debtId);
    if (!debt) {
      throw new Error(`Peer debt not found: ${debtId}`);
    }

    const { updatedDebt, actualPaymentMinor, isSettled } = applyRepayment(debt, amountMinor);

    if (this.peerDebtRepo.save) {
      await this.peerDebtRepo.save(updatedDebt);
    } else if (this.peerDebtRepo.update) {
      await this.peerDebtRepo.update(updatedDebt);
    }

    const repayment: PeerDebtRepayment = {
      id: crypto.randomUUID(),
      debtId,
      amountMinor: actualPaymentMinor,
      date: new Date().toISOString().slice(0, 10),
      notes: notes ?? null,
      createdAt: new Date().toISOString(),
    };

    await this.peerDebtRepo.addRepayment(repayment);

    return {
      updatedDebt,
      repayment,
      actualPaymentMinor,
      isSettled,
    };
  }

  async getPeerDebtSummary(): Promise<PeerDebtSummary> {
    const debts = await this.peerDebtRepo.findAll();
    return calculatePeerDebtSummary(debts);
  }

  async getSummary(): Promise<PeerDebtSummary> {
    return this.getPeerDebtSummary();
  }

  async repayPeerDebt(
    debtId: string,
    amountMinor: number,
    _accountId?: string,
    _date?: string,
    notes?: string
  ): Promise<PeerDebt> {
    const res = await this.recordRepayment(debtId, amountMinor, notes);
    return res.updatedDebt;
  }

  async getRepayments(debtId: string): Promise<PeerDebtRepayment[]> {
    return this.peerDebtRepo.getRepayments(debtId);
  }
}
