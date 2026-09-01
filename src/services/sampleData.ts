export interface SampleDatasetInfo {
  id: string;
  name: string;
  category: string;
  description: string;
  rowsCount: number;
  columnsCount: number;
  data: Record<string, any>[];
}

const generateQualityDemoData = (): Record<string, any>[] => {
  const countries = ['United States', 'united states', ' United States ', 'USA', 'Germany', 'germany', 'GERMANY', 'Japan', 'India', 'india', ' INDIA ', 'IND'];
  const categories = ['Electronics', 'Furniture', 'Office Supplies', 'Apparel'];
  const segments = ['Consumer', 'Corporate', 'Home Office'];

  const rows: Record<string, any>[] = [];

  for (let i = 1; i <= 150; i++) {
    const country = countries[i % countries.length];
    const category = categories[i % categories.length];
    const segment = segments[i % segments.length];
    const age = i === 12 ? -5 : i === 45 ? 999 : Math.floor(22 + (i * 1.3) % 45); // Negative and impossible age anomalies
    const salesStr = i % 8 === 0 ? `$${(450 + i * 12).toLocaleString()}` : (450 + i * 12); // String currency
    const discount = i % 5 === 0 ? null : (i % 3 === 0 ? 0.15 : 0.0); // Missing values
    const profit = Math.round((Number(typeof salesStr === 'number' ? salesStr : 500) * 0.22 - (i % 7 === 0 ? 150 : 0)) * 100) / 100;
    const rating = i === 25 ? 'N/A' : (i % 6 === 0 ? null : Math.min(5, Math.max(1, (i % 5) + 1)));
    let customerName = `Customer_${(i % 30) + 100}`;
    if (i % 9 === 0) customerName = `  ${customerName}  `; // Leading/trailing whitespace

    // Outlier in shipping cost
    const shippingCost = i === 18 ? 4850 : i === 77 ? 3920 : Math.round((25 + (i % 15) * 4.5) * 100) / 100;

    rows.push({
      TransactionID: `TRX-${10000 + (i === 50 ? 10001 : i)}`, // Duplicate ID anomaly at i=50
      OrderDate: `2024-${String((i % 12) + 1).padStart(2, '0')}-${String(((i * 3) % 28) + 1).padStart(2, '0')}`,
      CustomerName: customerName,
      Country: country,
      CustomerAge: age,
      Segment: segment,
      Category: category,
      Sales: salesStr,
      Discount: discount,
      Profit: profit,
      ShippingCost: shippingCost,
      CustomerRating: rating,
      ConstantStoreCode: 'STORE_HQ_99' // 100% Constant column
    });
  }

  // Add 4 exact duplicate rows at the end
  rows.push({ ...rows[5] });
  rows.push({ ...rows[10] });
  rows.push({ ...rows[20] });
  rows.push({ ...rows[35] });

  return rows;
};

const generateSuperstoreData = (): Record<string, any>[] => {
  const regions = ['North America', 'EMEA', 'APAC', 'LATAM'];
  const categories: Record<string, string[]> = {
    Technology: ['Phones', 'Laptops', 'Accessories', 'Copiers'],
    Furniture: ['Chairs', 'Tables', 'Bookcases', 'Furnishings'],
    'Office Supplies': ['Storage', 'Paper', 'Binders', 'Appliances', 'Art']
  };
  const segments = ['Consumer', 'Corporate', 'Home Office'];
  const shipModes = ['Standard Class', 'Second Class', 'First Class', 'Same Day'];

  const rows: Record<string, any>[] = [];
  for (let i = 1; i <= 240; i++) {
    const region = regions[i % regions.length];
    const catKeys = Object.keys(categories);
    const category = catKeys[i % catKeys.length];
    const subCats = categories[category];
    const subCategory = subCats[(i * 3) % subCats.length];
    const segment = segments[(i * 2) % segments.length];
    const shipMode = shipModes[i % shipModes.length];

    const month = (i % 12) + 1;
    const day = ((i * 7) % 28) + 1;
    const year = i > 150 ? 2025 : 2024;
    const orderDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const quantity = Math.floor((Math.sin(i) * 0.5 + 0.5) * 8) + 1;
    const basePrice = category === 'Technology' ? 450 : category === 'Furniture' ? 220 : 45;
    const discount = i % 5 === 0 ? 0.2 : i % 3 === 0 ? 0.1 : 0.0;
    const sales = Math.round((basePrice * quantity * (1 + (i % 10) * 0.15)) * 100) / 100;

    const margin = category === 'Technology' ? 0.28 : category === 'Furniture' ? (discount > 0.15 ? -0.05 : 0.12) : 0.35;
    const profit = Math.round((sales * margin - sales * discount * 0.8) * 100) / 100;
    const shippingCost = Math.round((sales * 0.06 + (shipMode === 'Same Day' ? 25 : 8)) * 100) / 100;
    const customerRating = Math.min(5, Math.max(1, Math.round((3.8 + Math.cos(i) * 1.1) * 10) / 10));

    let custName = `Customer_${(i % 45) + 100}`;
    if (i === 15) custName = `  Customer_115  `;
    if (i === 42) custName = `customer_142`;

    rows.push({
      OrderID: `ORD-${2024000 + i}`,
      OrderDate: orderDate,
      CustomerName: custName,
      Segment: segment,
      Region: region,
      Category: category,
      SubCategory: subCategory,
      Sales: sales,
      Quantity: quantity,
      Discount: discount,
      Profit: profit,
      ShippingCost: shippingCost,
      ShipMode: shipMode,
      CustomerRating: i === 33 ? null : customerRating,
      Returned: i % 14 === 0 ? 'Yes' : 'No'
    });
  }

  return rows;
};

const generateSaaSChurnData = (): Record<string, any>[] => {
  const plans = ['Starter', 'Professional', 'Enterprise', 'Growth'];
  const industries = ['SaaS / Tech', 'Fintech', 'Healthcare', 'E-commerce', 'Consulting'];
  const contractTypes = ['Monthly', 'Annual', 'Multi-Year'];

  const rows: Record<string, any>[] = [];
  for (let i = 1; i <= 200; i++) {
    const plan = plans[i % plans.length];
    const industry = industries[(i * 2) % industries.length];
    const contract = contractTypes[(i * 3) % contractTypes.length];
    const tenureMonths = Math.floor((i * 1.7) % 48) + 1;

    const baseMRR = plan === 'Enterprise' ? 2400 : plan === 'Growth' ? 950 : plan === 'Professional' ? 450 : 99;
    const mrr = Math.round((baseMRR * (1 + ((i % 7) - 3) * 0.08)) * 100) / 100;
    const activeUsers = Math.floor(mrr / (plan === 'Enterprise' ? 40 : 25)) + Math.floor(Math.sin(i) * 5);
    const supportTickets = Math.max(0, Math.floor(Math.cos(i) * 4 + (i % 6)));
    const npsScore = Math.min(10, Math.max(0, Math.round((7.5 - supportTickets * 0.6 + Math.sin(i) * 2) * 10) / 10));
    const featureUsagePercent = Math.min(100, Math.max(15, Math.round(55 + tenureMonths * 0.7 - supportTickets * 3)));

    const isChurnRisk = supportTickets > 5 || npsScore < 5 || featureUsagePercent < 35;
    const churn = isChurnRisk && i % 2 === 0 ? 'Churned' : 'Active';
    const ltv = Math.round(mrr * tenureMonths);
    const cac = Math.round(mrr * 1.4 + 200);

    rows.push({
      CompanyID: `ORG-${1000 + i}`,
      PlanTier: plan,
      Industry: industry,
      ContractType: contract,
      TenureMonths: tenureMonths,
      MonthlyRecurringRevenue: mrr,
      ActiveUsers: activeUsers > 0 ? activeUsers : 1,
      SupportTickets: supportTickets,
      NPSScore: npsScore,
      FeatureUsagePct: featureUsagePercent,
      CustomerLifetimeValue: ltv,
      AcquisitionCost: cac,
      ChurnStatus: churn
    });
  }
  return rows;
};

const generateHRCompensationData = (): Record<string, any>[] => {
  const departments = ['Engineering', 'Product', 'Sales', 'Marketing', 'Finance', 'Human Resources'];
  const education = ["Bachelor's", "Master's", "PhD", "Associate's"];

  const rows: Record<string, any>[] = [];
  for (let i = 1; i <= 180; i++) {
    const dept = departments[i % departments.length];
    const edu = education[(i * 3) % education.length];
    const experienceYears = Math.floor((i * 1.3) % 22) + 1;
    const age = 22 + experienceYears + Math.floor(i % 8);

    const baseSalary = dept === 'Engineering' ? 115000 : dept === 'Product' ? 110000 : dept === 'Finance' ? 95000 : dept === 'Sales' ? 80000 : 75000;
    const salary = Math.round(baseSalary + experienceYears * 4200 + (edu === 'PhD' ? 18000 : edu === "Master's" ? 9000 : 0) + Math.sin(i) * 7000);
    const performanceRating = Math.min(5, Math.max(1, Math.round((3.2 + Math.cos(i * 0.7) * 1.2) * 10) / 10));
    const overtimeHours = dept === 'Engineering' || dept === 'Sales' ? Math.floor(Math.sin(i) * 15 + 15) : Math.floor(i % 10);
    const bonus = Math.round(salary * (performanceRating >= 4.0 ? 0.18 : performanceRating >= 3.0 ? 0.08 : 0.02));
    const projectsCompleted = Math.floor(experienceYears * 1.8 + performanceRating * 3);
    const satisfactionScore = Math.min(100, Math.max(20, Math.round(75 + (bonus / salary) * 80 - overtimeHours * 1.2)));
    const attrition = satisfactionScore < 50 && overtimeHours > 20 ? 'Yes' : 'No';

    rows.push({
      EmployeeID: `EMP-${5000 + i}`,
      Department: dept,
      EducationLevel: edu,
      Age: age,
      ExperienceYears: experienceYears,
      BaseSalary: salary,
      Bonus: bonus,
      PerformanceRating: performanceRating,
      OvertimeHoursPerMonth: overtimeHours,
      ProjectsCompleted: projectsCompleted,
      SatisfactionScore: satisfactionScore,
      Attrition: attrition
    });
  }
  return rows;
};

export const SAMPLE_DATASETS: SampleDatasetInfo[] = [
  {
    id: 'quality-audit-demo',
    name: 'Customer Orders & Quality Benchmark',
    category: 'Data Quality & Cleaning Benchmark',
    description: 'Realistic raw dataset with deliberate anomalies: duplicate rows, missing values, string currency, mixed case country labels, negative age, extreme outliers, and constant store codes.',
    rowsCount: 154,
    columnsCount: 13,
    data: generateQualityDemoData()
  },
  {
    id: 'superstore-sales',
    name: 'Global Superstore Sales & Profitability',
    category: 'E-Commerce & Retail',
    description: 'Comprehensive transactional sales dataset with regions, categories, discounts, shipping costs, customer ratings, and profit margins.',
    rowsCount: 240,
    columnsCount: 15,
    data: generateSuperstoreData()
  },
  {
    id: 'saas-churn-metrics',
    name: 'SaaS Subscriptions & Churn Analysis',
    category: 'SaaS & Customer Success',
    description: 'B2B subscription telemetry tracking MRR, plan tiers, tenure, NPS scores, feature usage, support ticket spikes, and churn outcomes.',
    rowsCount: 200,
    columnsCount: 13,
    data: generateSaaSChurnData()
  },
  {
    id: 'hr-compensation',
    name: 'Employee Compensation & Attrition',
    category: 'Human Resources & Talent',
    description: 'Workforce dataset analyzing salaries, performance ratings, overtime workload, experience, education, and employee attrition triggers.',
    rowsCount: 180,
    columnsCount: 12,
    data: generateHRCompensationData()
  }
];
