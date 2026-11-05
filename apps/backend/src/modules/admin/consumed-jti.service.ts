import mongoose, { Schema } from 'mongoose';
import { AppError } from '../../utils/errors.js';

// ---- Mongoose Model for consumed pending JTIs with 5-minute TTL ------------
const ConsumedPendingJtiSchema = new Schema(
  {
    jti: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } }
  },
  { timestamps: true }
);

const ConsumedPendingJtiModel =
  mongoose.models.AdminConsumedPendingJti ||
  mongoose.model('AdminConsumedPendingJti', ConsumedPendingJtiSchema, 'admin_consumed_pending_jtis');

// In-memory set for zero-latency lookups and offline unit test resiliency
const inMemoryConsumedJtis = new Map<string, number>();

export const consumedPendingJtiService = {
  /**
   * Check if a JTI has already been consumed.
   */
  async isConsumed(jti: string): Promise<boolean> {
    if (!jti) return false;

    // Check in-memory store first
    const inMemExp = inMemoryConsumedJtis.get(jti);
    if (inMemExp && inMemExp > Date.now()) {
      return true;
    }

    // Check MongoDB if connected
    if (mongoose.connection.readyState === 1) {
      try {
        const found = await ConsumedPendingJtiModel.findOne({ jti });
        if (found) {
          inMemoryConsumedJtis.set(jti, found.expiresAt.getTime());
          return true;
        }
      } catch {
        // Fall back to in-memory state
      }
    }

    return false;
  },

  /**
   * Atomically consume a pending token JTI. Throws 401 if already consumed.
   */
  async consume(jti: string, userId: string): Promise<void> {
    if (!jti) {
      throw AppError.unauthorized('Invalid pending token: missing JTI');
    }

    // Check if already consumed
    if (await this.isConsumed(jti)) {
      throw AppError.unauthorized('Two-factor pending token has already been consumed');
    }

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min TTL
    inMemoryConsumedJtis.set(jti, expiresAt.getTime());

    if (mongoose.connection.readyState === 1) {
      try {
        await ConsumedPendingJtiModel.create({
          jti,
          userId,
          expiresAt
        });
      } catch (err: any) {
        if (err?.code === 11000) {
          throw AppError.unauthorized('Two-factor pending token has already been consumed');
        }
        throw err;
      }
    }
  },

  /**
   * Reset in-memory cache (for testing purposes).
   */
  clearMemory(): void {
    inMemoryConsumedJtis.clear();
  }
};
