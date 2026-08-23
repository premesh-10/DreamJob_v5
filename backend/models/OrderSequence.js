import mongoose from 'mongoose';

/**
 * OrderSequence — atomic monotonic counter for sequential Order ID and Invoice Number generation.
 *
 * Each document holds one named counter (e.g. "order_course", "order_interview",
 * "invoice_202607"). The findOneAndUpdate + $inc + upsert:true pattern ensures
 * that two concurrent requests can never receive the same sequence number, even
 * under high concurrency — MongoDB serialises single-document writes.
 */
const orderSequenceSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    seq: { type: Number, default: 0 },
});

const OrderSequence = mongoose.model('OrderSequence', orderSequenceSchema);
export default OrderSequence;
