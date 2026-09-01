import { ColumnClassification, ColumnProfile, ColumnType, SemanticClassification } from '../types/dataset';

// Geographic name dictionary & patterns
const GEO_PATTERNS = /^(country|nation|state|province|city|region|territory|zip|postal|postal_code|zipcode|lat|latitude|lon|longitude|continent|county|district|town)$/i;

// Identifier patterns
const ID_PATTERNS = /^(id|uuid|_id|.*_id|.*id|key|code|customer_id|order_id|user_id|employee_id|product_id|trans_id|invoice_id|sku|account_num|account_number|ssn)$/i;

// Currency & Financial patterns
const CURRENCY_PATTERNS = /^(revenue|sales|profit|price|cost|salary|income|budget|amount|total|mrr|arr|arr_usd|ltv|cac|spend|fee|tax|gross_margin|net_income|unit_price|discount_amount|balance)$/i;

// Percentage & Rate patterns
const PERCENTAGE_PATTERNS = /^(percentage|pct|rate|ratio|margin|discount|tax_rate|interest_rate|conversion_rate|churn_rate|roi|bounce_rate|growth_rate)$/i;

// Target Candidate patterns
const TARGET_PATTERNS = /^(target|label|churn|churned|converted|status|outcome|fraud|default|is_churn|is_default|revenue|sales|profit|rating|score|class|category)$/i;

// Ordinal indicator patterns
const ORDINAL_PATTERNS = /^(rating|grade|level|tier|priority|stage|satisfaction|rank|ranking|size|education|experience_level|severity)$/i;

export function classifyColumn(
  columnName: string,
  profile: ColumnProfile,
  totalRows: number
): ColumnClassification {
  const normName = columnName.toLowerCase().replace(/[\s_-]+/g, '_');
  const type = profile.type;
  const uniqueCount = profile.uniqueCount;
  const cardRatio = profile.cardinalityRatio;
  const samples = profile.sampleValues.filter(v => v !== null && v !== undefined);

  let semanticType: SemanticClassification = 'categorical_nominal';
  let suggestedRole: 'feature' | 'target' | 'identifier' | 'dimension' | 'time' | 'measure' = 'dimension';
  let confidence = 85;
  let isIdentifier = false;
  let isCurrency = false;
  let isPercentage = false;
  let isGeographic = false;
  let isOrdinal = false;
  let isTargetCandidate = false;
  let reasoning = '';

  // 1. DATE / TIME CLASSIFICATION
  if (type === 'datetime' || /date|time|timestamp|created_at|updated_at|year|month|quarter|day/i.test(normName)) {
    semanticType = 'datetime';
    suggestedRole = 'time';
    confidence = 95;
    reasoning = `Identified as datetime chronological variable from timestamp format and header name '${columnName}'.`;
    return {
      column: columnName,
      primaryType: 'datetime',
      semanticType,
      confidence,
      isTargetCandidate: false,
      isIdentifier: false,
      isCurrency: false,
      isPercentage: false,
      isGeographic: false,
      isOrdinal: false,
      suggestedRole,
      reasoning
    };
  }

  // 2. BOOLEAN CLASSIFICATION
  if (type === 'boolean' || (uniqueCount === 2 && samples.every(s => /^(true|false|0|1|yes|no|y|n)$/i.test(String(s))))) {
    semanticType = 'boolean';
    suggestedRole = 'feature';
    confidence = 95;
    if (TARGET_PATTERNS.test(normName)) {
      isTargetCandidate = true;
      suggestedRole = 'target';
    }
    reasoning = `Binary boolean flag with 2 distinct states.`;
    return {
      column: columnName,
      primaryType: 'boolean',
      semanticType,
      confidence,
      isTargetCandidate,
      isIdentifier: false,
      isCurrency: false,
      isPercentage: false,
      isGeographic: false,
      isOrdinal: false,
      suggestedRole,
      reasoning
    };
  }

  // 3. IDENTIFIER / KEY CLASSIFICATION
  if (
    ID_PATTERNS.test(normName) ||
    type === 'id' ||
    (cardRatio > 0.95 && totalRows >= 20 && (type === 'categorical' || type === 'text'))
  ) {
    isIdentifier = true;
    semanticType = 'identifier';
    suggestedRole = 'identifier';
    confidence = 90;
    reasoning = `High cardinality identifier key (${uniqueCount} unique records) serving as unique record entity ID.`;
    return {
      column: columnName,
      primaryType: type === 'numeric' ? 'numeric' : 'id',
      semanticType,
      confidence,
      isTargetCandidate: false,
      isIdentifier: true,
      isCurrency: false,
      isPercentage: false,
      isGeographic: false,
      isOrdinal: false,
      suggestedRole,
      reasoning
    };
  }

  // 4. GEOGRAPHIC CLASSIFICATION
  if (
    GEO_PATTERNS.test(normName) ||
    samples.some(s => /^(usa|united states|uk|canada|germany|france|india|china|japan|brazil|california|texas|new york|london|tokyo|paris|north america|europe|asia)$/i.test(String(s).trim()))
  ) {
    isGeographic = true;
    semanticType = 'geographic';
    suggestedRole = 'dimension';
    confidence = 92;
    reasoning = `Geospatial territory/region dimension appropriate for regional segmentations.`;
    return {
      column: columnName,
      primaryType: 'categorical',
      semanticType,
      confidence,
      isTargetCandidate: false,
      isIdentifier: false,
      isCurrency: false,
      isPercentage: false,
      isGeographic: true,
      isOrdinal: false,
      suggestedRole,
      reasoning
    };
  }

  // 5. NUMERIC CLASSIFICATIONS (CURRENCY, PERCENTAGE, DISCRETE, CONTINUOUS)
  if (type === 'numeric') {
    suggestedRole = 'measure';

    // Currency check
    if (
      CURRENCY_PATTERNS.test(normName) ||
      samples.some(s => /[$€£¥₹]/.test(String(s))) ||
      (profile.mean !== undefined && profile.mean > 10 && !PERCENTAGE_PATTERNS.test(normName) && /sales|revenue|profit|cost|spend|price|amount/i.test(normName))
    ) {
      isCurrency = true;
      semanticType = 'currency';
      confidence = 92;
      reasoning = `Monetary financial measure formatted as currency.`;
    }
    // Percentage check
    else if (
      PERCENTAGE_PATTERNS.test(normName) ||
      samples.some(s => /%/.test(String(s))) ||
      (profile.min !== undefined && profile.max !== undefined && profile.min >= 0 && profile.max <= 1 && /rate|ratio|margin|pct|pct_/i.test(normName)) ||
      (profile.min !== undefined && profile.max !== undefined && profile.min >= 0 && profile.max <= 100 && /rate|ratio|margin|discount/i.test(normName))
    ) {
      isPercentage = true;
      semanticType = 'percentage';
      confidence = 90;
      reasoning = `Ratio/percentage rate metric bounded across proportional scale.`;
    }
    // Discrete integer count (e.g. quantity, order count, children)
    else if (uniqueCount < 20 && profile.min !== undefined && Number.isInteger(profile.min) && profile.max !== undefined && Number.isInteger(profile.max)) {
      semanticType = 'numeric_discrete';
      confidence = 88;
      reasoning = `Discrete integer count with small cardinality step intervals.`;
    }
    // Continuous ratio
    else {
      semanticType = 'numeric_continuous';
      confidence = 85;
      reasoning = `Continuous quantitative analytical measure.`;
    }

    if (TARGET_PATTERNS.test(normName)) {
      isTargetCandidate = true;
    }

    return {
      column: columnName,
      primaryType: 'numeric',
      semanticType,
      confidence,
      isTargetCandidate,
      isIdentifier: false,
      isCurrency,
      isPercentage,
      isGeographic: false,
      isOrdinal: false,
      suggestedRole,
      reasoning
    };
  }

  // 6. CATEGORICAL & ORDINAL CLASSIFICATIONS
  if (type === 'categorical' || type === 'text') {
    suggestedRole = 'dimension';

    if (ORDINAL_PATTERNS.test(normName) || samples.some(s => /^(low|medium|high|critical|tier [1-5]|grade [a-f]|[1-5] stars?)$/i.test(String(s).trim()))) {
      isOrdinal = true;
      semanticType = 'categorical_ordinal';
      confidence = 88;
      reasoning = `Ordered qualitative ranking scale.`;
    } else if (cardRatio > 0.6 && totalRows > 50) {
      semanticType = 'text_free';
      confidence = 80;
      reasoning = `High-entropy unconstrained descriptive text.`;
    } else {
      semanticType = 'categorical_nominal';
      confidence = 90;
      reasoning = `Discrete categorical dimension suitable for slicing, grouping, and aggregations.`;
    }

    if (TARGET_PATTERNS.test(normName) && uniqueCount <= 10) {
      isTargetCandidate = true;
      suggestedRole = 'target';
    }

    return {
      column: columnName,
      primaryType: 'categorical',
      semanticType,
      confidence,
      isTargetCandidate,
      isIdentifier: false,
      isCurrency: false,
      isPercentage: false,
      isGeographic: false,
      isOrdinal,
      suggestedRole,
      reasoning
    };
  }

  // Default fallback
  return {
    column: columnName,
    primaryType: type,
    semanticType: 'categorical_nominal',
    confidence: 70,
    isTargetCandidate: false,
    isIdentifier: false,
    isCurrency: false,
    isPercentage: false,
    isGeographic: false,
    isOrdinal: false,
    suggestedRole: 'dimension',
    reasoning: `Standard attribute.`
  };
}

export function classifyAllColumns(
  columns: string[],
  profiles: Record<string, ColumnProfile>,
  totalRows: number
): Record<string, ColumnClassification> {
  const result: Record<string, ColumnClassification> = {};
  for (const col of columns) {
    const prof = profiles[col] || {
      name: col,
      type: 'categorical',
      inferredType: 'string',
      totalCount: totalRows,
      nullCount: 0,
      nullPercentage: 0,
      uniqueCount: 0,
      cardinalityRatio: 0,
      sampleValues: []
    };
    result[col] = classifyColumn(col, prof, totalRows);
  }
  return result;
}
