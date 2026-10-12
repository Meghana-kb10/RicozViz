import mongoose from 'mongoose';
import { UserModel } from './models/user.model';
import { ProductModel } from './models/product.model';

export interface DatabaseConfig {
  uri?: string;
  dbName?: string;
  autoSeed?: boolean;
  serverSelectionTimeoutMS?: number;
}

export async function connectDatabase(config: DatabaseConfig = {}): Promise<typeof mongoose> {
  const uri = config.uri || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/core_mono';
  const dbName = config.dbName || process.env.MONGODB_DB_NAME || process.env.DB_NAME;

  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  await mongoose.connect(uri, {
    dbName: dbName || undefined,
    serverSelectionTimeoutMS: config.serverSelectionTimeoutMS ?? 2000
  });

  if (config.autoSeed ?? (process.env.NODE_ENV !== 'production')) {
    await seedInitialData();
  }

  return mongoose;
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export function getConnectionState(): 'disconnected' | 'connected' | 'connecting' | 'disconnecting' {
  switch (mongoose.connection.readyState) {
    case 0:
      return 'disconnected';
    case 1:
      return 'connected';
    case 2:
      return 'connecting';
    case 3:
      return 'disconnecting';
    default:
      return 'disconnected';
  }
}

export async function seedInitialData(): Promise<void> {
  try {
    const userCount = await UserModel.countDocuments();
    if (userCount === 0) {
      await UserModel.create([
        {
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          role: 'admin'
        },
        {
          name: 'Alan Turing',
          email: 'alan@example.com',
          role: 'user'
        }
      ]);
    }

    const productCount = await ProductModel.countDocuments();
    if (productCount === 0) {
      await ProductModel.create([
        {
          title: 'Quantum Keycap Set',
          description: 'Double-shot PBT mechanical keyboard keycaps with custom glyphs.',
          price: 89.99,
          category: 'Hardware',
          inStock: true
        },
        {
          title: 'Ergonomic Desk Mat',
          description: 'Micro-weave cloth surface with non-slip natural rubber base.',
          price: 29.5,
          category: 'Accessories',
          inStock: true
        },
        {
          title: 'Monorepo Architect T-Shirt',
          description: '100% organic cotton tee with subtle Turborepo pipeline diagram.',
          price: 34.0,
          category: 'Apparel',
          inStock: false
        }
      ]);
    }
  } catch (error) {
    // If seed fails (e.g. database not connected or duplicate key), don't crash startup
    console.warn('[Database] Initial seed warning:', error instanceof Error ? error.message : error);
  }
}
