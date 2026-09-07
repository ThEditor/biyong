import {
  calculateSubscriptionBurnRate,
  detectSubscriptionsFromTransactions,
  type SubscriptionBurnRate,
} from '@biyong/domain';
import type { SubscriptionItem } from '@biyong/schemas';
import type { SubscriptionRepository, TransactionRepository } from '../repositories.js';

export class SubscriptionUseCases {
  constructor(
    private subscriptionRepo: SubscriptionRepository,
    private txRepo?: TransactionRepository
  ) {}

  async createSubscription(subscription: SubscriptionItem): Promise<void> {
    if (this.subscriptionRepo.save) {
      await this.subscriptionRepo.save(subscription);
    } else if (this.subscriptionRepo.create) {
      await this.subscriptionRepo.create(subscription);
    }
  }

  async getSubscription(id: string): Promise<SubscriptionItem | null> {
    return this.subscriptionRepo.findById(id);
  }

  async listSubscriptions(): Promise<SubscriptionItem[]> {
    return this.subscriptionRepo.findAll();
  }

  async updateSubscription(subscription: SubscriptionItem): Promise<void> {
    if (this.subscriptionRepo.save) {
      await this.subscriptionRepo.save(subscription);
    } else if (this.subscriptionRepo.update) {
      await this.subscriptionRepo.update(subscription);
    }
  }

  async deleteSubscription(id: string): Promise<void> {
    return this.subscriptionRepo.delete(id);
  }

  async pauseSubscription(id: string): Promise<void> {
    const sub = await this.subscriptionRepo.findById(id);
    if (!sub) {
      throw new Error(`Subscription not found: ${id}`);
    }
    await this.updateSubscription({
      ...sub,
      status: 'paused',
      updatedAt: new Date().toISOString(),
    });
  }

  async cancelSubscription(id: string): Promise<void> {
    const sub = await this.subscriptionRepo.findById(id);
    if (!sub) {
      throw new Error(`Subscription not found: ${id}`);
    }
    await this.updateSubscription({
      ...sub,
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
    });
  }

  async getBurnRate(): Promise<SubscriptionBurnRate> {
    const subscriptions = await this.subscriptionRepo.findAll();
    return calculateSubscriptionBurnRate(subscriptions);
  }

  async detectSubscriptions(): Promise<Omit<SubscriptionItem, 'id' | 'createdAt' | 'updatedAt'>[]> {
    const transactions = this.txRepo ? await this.txRepo.findAll() : [];
    return detectSubscriptionsFromTransactions(transactions);
  }
}
