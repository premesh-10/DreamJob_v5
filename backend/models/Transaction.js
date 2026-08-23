import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['credit', 'debit'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'completed'
    },
    // Cashfree order ID — sparse unique index prevents double-crediting at the DB level.
    // No `default` here deliberately: a sparse index only skips documents where the field
    // is genuinely absent. If Mongoose persisted an explicit `default: null`, every
    // non-Cashfree transaction (wallet adjustments, withdrawal payouts) would collide on
    // that same null value and the second one would always fail to save.
    cashfreeOrderId: {
        type: String,
        index: true,
        unique: true,
        sparse: true,
    }
}, {
    timestamps: true
});

const Transaction = mongoose.model('Transaction', transactionSchema);
export default Transaction;
