import type { Product } from '@repo/types';
import type { IProductDocument } from '../models/product.model';

export function serializeProduct(doc: IProductDocument | Record<string, unknown>): Product {
  const raw = typeof (doc as IProductDocument).toObject === 'function' 
    ? (doc as IProductDocument).toObject() 
    : doc;

  const id = raw._id ? String(raw._id) : String(raw.id || '');

  return {
    id,
    title: String(raw.title || ''),
    description: String(raw.description || ''),
    price: Number(raw.price || 0),
    category: String(raw.category || ''),
    inStock: Boolean(raw.inStock ?? true)
  };
}

export function serializeProducts(docs: (IProductDocument | Record<string, unknown>)[]): Product[] {
  return docs.map(serializeProduct);
}
