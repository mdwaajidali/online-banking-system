import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema(
  {
    accountNumber: { type: String, required: true, unique: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['savings', 'current'], default: 'savings' },
    // Money is stored as whole paise (integers) so there are no floating-point rounding errors.
    balance: { type: Number, required: true, default: 0, min: 0, validate: Number.isInteger },
    status: { type: String, enum: ['active', 'frozen', 'closed'], default: 'active' },
    nickname: { type: String, trim: true, maxlength: 40 },
  },
  { timestamps: true }
);

accountSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    accountNumber: this.accountNumber,
    type: this.type,
    balance: this.balance,
    status: this.status,
    nickname: this.nickname,
    createdAt: this.createdAt,
  };
};

export const Account = mongoose.model('Account', accountSchema);
