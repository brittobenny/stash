const inrFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

export const formatCurrency = (amount) => {
    const value = Number(amount || 0);
    return inrFormatter.format(Number.isFinite(value) ? value : 0);
};
