import {
  calculatePersonalSpendingBreakdown,
  calculateReimbursementSummary,
  type PersonalSpendingBreakdown,
  type ReimbursementSummary,
} from '@biyong/domain';
import type { ReimbursementClaim } from '@biyong/schemas';
import type { ReimbursementRepository, TransactionRepository } from '../repositories.js';

export class ReimbursementUseCases {
  constructor(
    private reimbursementRepo: ReimbursementRepository,
    private txRepo?: TransactionRepository
  ) {}

  async createClaim(claim: ReimbursementClaim): Promise<void> {
    if (this.reimbursementRepo.save) {
      await this.reimbursementRepo.save(claim);
    } else if (this.reimbursementRepo.create) {
      await this.reimbursementRepo.create(claim);
    }
  }

  async getClaim(id: string): Promise<ReimbursementClaim | null> {
    return this.reimbursementRepo.findById(id);
  }

  async listClaims(): Promise<ReimbursementClaim[]> {
    return this.reimbursementRepo.findAll();
  }

  async updateClaim(claim: ReimbursementClaim): Promise<void> {
    if (this.reimbursementRepo.save) {
      await this.reimbursementRepo.save(claim);
    } else if (this.reimbursementRepo.update) {
      await this.reimbursementRepo.update(claim);
    }
  }

  async deleteClaim(id: string): Promise<void> {
    return this.reimbursementRepo.delete(id);
  }

  async markClaimReimbursed(
    id: string,
    settledDate = new Date().toISOString().slice(0, 10)
  ): Promise<ReimbursementClaim> {
    const claim = await this.reimbursementRepo.findById(id);
    if (!claim) {
      throw new Error(`Reimbursement claim not found: ${id}`);
    }

    const updated: ReimbursementClaim = {
      ...claim,
      status: 'reimbursed',
      settledDate,
      updatedAt: new Date().toISOString(),
    };

    if (this.reimbursementRepo.save) {
      await this.reimbursementRepo.save(updated);
    } else if (this.reimbursementRepo.update) {
      await this.reimbursementRepo.update(updated);
    }

    return updated;
  }

  async updateClaimStatus(
    id: string,
    status: ReimbursementClaim['status'],
    settledDate?: string | null
  ): Promise<ReimbursementClaim> {
    const claim = await this.reimbursementRepo.findById(id);
    if (!claim) {
      throw new Error(`Reimbursement claim not found: ${id}`);
    }

    const updated: ReimbursementClaim = {
      ...claim,
      status,
      settledDate: status === 'reimbursed' ? (settledDate ?? new Date().toISOString().slice(0, 10)) : claim.settledDate,
      updatedAt: new Date().toISOString(),
    };

    if (this.reimbursementRepo.save) {
      await this.reimbursementRepo.save(updated);
    } else if (this.reimbursementRepo.update) {
      await this.reimbursementRepo.update(updated);
    }

    return updated;
  }

  async getSummary(): Promise<ReimbursementSummary> {
    const claims = await this.reimbursementRepo.findAll();
    return calculateReimbursementSummary(claims);
  }

  async getSpendingBreakdown(): Promise<PersonalSpendingBreakdown> {
    const claims = await this.reimbursementRepo.findAll();
    const transactions = this.txRepo ? await this.txRepo.findAll() : [];
    return calculatePersonalSpendingBreakdown(transactions, claims);
  }
}
