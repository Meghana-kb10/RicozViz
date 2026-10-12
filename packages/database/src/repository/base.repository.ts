import type { Model, Document, QueryFilter, UpdateQuery, PopulateOptions } from 'mongoose';
import { toObjectId } from '../models/model.util';

export interface QueryPaginationOptions {
  skip?: number;
  limit?: number;
  sort?: Record<string, 1 | -1 | 'asc' | 'desc'> | string;
}

export abstract class BaseRepository<TDocument extends Document> {
  protected model: Model<TDocument>;

  constructor(model: Model<TDocument>) {
    this.model = model;
  }

  async findById(id: string): Promise<TDocument | null> {
    const objectId = toObjectId(id);
    if (!objectId) {
      return null;
    }
    return this.model.findById(objectId).exec();
  }

  async findOne(filter: QueryFilter<TDocument>): Promise<TDocument | null> {
    return this.model.findOne(filter).exec();
  }

  async find(filter: QueryFilter<TDocument> = {}, options: QueryPaginationOptions = {}): Promise<TDocument[]> {
    let query = this.model.find(filter);

    if (options.sort) {
      query = query.sort(options.sort as never);
    }
    if (typeof options.skip === 'number') {
      query = query.skip(options.skip);
    }
    if (typeof options.limit === 'number') {
      query = query.limit(options.limit);
    }

    return query.exec();
  }

  async findOneAndPopulate(
    filter: QueryFilter<TDocument>,
    populate: PopulateOptions | PopulateOptions[]
  ): Promise<TDocument | null> {
    return this.model.findOne(filter).populate(populate).exec();
  }

  async create(data: Partial<TDocument>): Promise<TDocument> {
    const created = new this.model(data);
    return created.save();
  }

  async update(id: string, update: UpdateQuery<TDocument>): Promise<TDocument | null> {
    const objectId = toObjectId(id);
    if (!objectId) {
      return null;
    }
    return this.model.findByIdAndUpdate(objectId, update, { new: true, runValidators: true }).exec();
  }

  async updateMany(filter: QueryFilter<TDocument>, update: UpdateQuery<TDocument>): Promise<number> {
    const result = await this.model.updateMany(filter, update).exec();
    return result.modifiedCount;
  }

  async delete(id: string): Promise<boolean> {
    const objectId = toObjectId(id);
    if (!objectId) {
      return false;
    }
    const result = await this.model.findByIdAndDelete(objectId).exec();
    return !!result;
  }

  async deleteMany(filter: QueryFilter<TDocument>): Promise<number> {
    const result = await this.model.deleteMany(filter).exec();
    return result.deletedCount ?? 0;
  }

  async count(filter: QueryFilter<TDocument> = {}): Promise<number> {
    return this.model.countDocuments(filter).exec();
  }

  async exists(filter: QueryFilter<TDocument>): Promise<boolean> {
    const doc = await this.model.exists(filter).exec();
    return doc !== null;
  }
}