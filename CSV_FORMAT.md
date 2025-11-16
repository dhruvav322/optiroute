# 📄 CSV Upload Format Guide

## Required Format

Your CSV file must have the following structure:

### Required Columns

1. **`date`** (or `Date`, `DATE`) - The date of the sales/demand record
2. **`quantity`** (or `Quantity`, `QUANTITY`, `qty`, `Qty`) - The quantity/demand value

### Column Names

- Column names are **case-insensitive** (e.g., `date`, `Date`, `DATE` all work)
- The system automatically detects and normalizes column names
- Only `date` and `quantity` columns are required; additional columns are ignored

## Format Requirements

### Date Format
- **Format**: `YYYY-MM-DD` (e.g., `2024-01-15`)
- **Examples**: 
  - ✅ `2024-01-15`
  - ✅ `2023-12-25`
  - ❌ `01/15/2024` (won't work)
  - ❌ `15-01-2024` (won't work)

### Quantity Format
- Must be a **numeric value** (integer or decimal)
- Will be converted to integer automatically
- **Examples**:
  - ✅ `100`
  - ✅ `150.5` (will become `150`)
  - ✅ `0`
  - ❌ `abc` (won't work)
  - ❌ Empty values (won't work)

## Example CSV File

```csv
date,quantity
2024-01-01,120
2024-01-02,135
2024-01-03,98
2024-01-04,145
2024-01-05,110
2024-01-06,125
2024-01-07,140
```

### Alternative Column Names (All Work)

```csv
Date,Quantity
2024-01-01,120
2024-01-02,135
```

```csv
DATE,QTY
2024-01-01,120
2024-01-02,135
```

## Minimum Requirements

- **At least 60 data points** (rows) are required for:
  - Feature analysis
  - Model evaluation
  - Accurate forecasting

- **Recommended**: 90+ days of daily data for best results

## File Requirements

- **File type**: `.csv` (comma-separated values)
- **Encoding**: UTF-8
- **Max file size**: 10 MB (default, configurable)
- **No empty rows**: All rows should have valid data

## Complete Example

Here's a complete example CSV file with 90 days of data:

```csv
date,quantity
2023-10-01,120
2023-10-02,135
2023-10-03,98
2023-10-04,145
2023-10-05,110
2023-10-06,125
2023-10-07,140
2023-10-08,115
2023-10-09,130
2023-10-10,105
... (continue for at least 60 days)
```

## Creating Your CSV

### From Excel/Google Sheets:
1. Create two columns: `date` and `quantity`
2. Format dates as `YYYY-MM-DD`
3. Save as CSV (UTF-8 encoding)
4. Upload via MLOps Panel

### From Python:
```python
import pandas as pd
from datetime import datetime, timedelta

# Generate sample data
dates = [datetime(2024, 1, 1) + timedelta(days=i) for i in range(90)]
quantities = [100 + (i % 30) * 5 for i in range(90)]  # Sample pattern

df = pd.DataFrame({
    'date': [d.strftime('%Y-%m-%d') for d in dates],
    'quantity': quantities
})

df.to_csv('sales_data.csv', index=False)
```

### From SQL Database:
```sql
SELECT 
    DATE_FORMAT(sale_date, '%Y-%m-%d') as date,
    SUM(quantity) as quantity
FROM sales
GROUP BY sale_date
ORDER BY sale_date
INTO OUTFILE 'sales_data.csv'
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n';
```

## Common Issues & Solutions

### ❌ "CSV must include 'date' and 'quantity' columns"
- **Solution**: Make sure your CSV has headers with `date` and `quantity` (case-insensitive)

### ❌ "CSV contains rows with invalid date values"
- **Solution**: Use `YYYY-MM-DD` format (e.g., `2024-01-15`, not `01/15/2024`)

### ❌ "CSV contains rows with non-numeric quantity values"
- **Solution**: Ensure all quantity values are numbers (no text, no empty cells)

### ❌ "At least 60 observations are required"
- **Solution**: Upload a CSV with at least 60 rows of data

### ❌ "Only CSV files are allowed"
- **Solution**: Make sure your file has a `.csv` extension

## Tips for Best Results

1. **Daily data**: Use daily sales/demand data for best forecasting accuracy
2. **Complete data**: Avoid gaps in dates (fill missing days with 0 if needed)
3. **Consistent format**: Keep date format consistent throughout
4. **Clean data**: Remove outliers or handle them during model training
5. **More data = better**: 90+ days gives better forecasts than 60 days

## Next Steps

After uploading your CSV:

1. ✅ Verify upload success (check records_added count)
2. ✅ Train the model (click "Retrain Forecast Model" in MLOps Panel)
3. ✅ View forecasts in the dashboard
4. ✅ Run simulations with your data
5. ✅ Analyze features and model performance

---

**Need help?** Check the [README.md](README.md) or [QUICK_START.md](QUICK_START.md) for more information.

