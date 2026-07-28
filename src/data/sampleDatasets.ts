import { Dataset } from '../types';
import { profileDataset } from '../lib/dataProfiler';

const salesData = [
  { Order_ID: "ORD-1001", Order_Date: "2026-01-05", Category: "Technology", Sub_Category: "Smartphones", Region: "North America", Customer_Segment: "Corporate", Sales: 12500, Profit: 3200, Quantity: 10, Discount: 0.05 },
  { Order_ID: "ORD-1002", Order_Date: "2026-01-12", Category: "Technology", Sub_Category: "Laptops", Region: "Europe", Customer_Segment: "Consumer", Sales: 18900, Profit: 4500, Quantity: 15, Discount: 0.10 },
  { Order_ID: "ORD-1003", Order_Date: "2026-01-18", Category: "Furniture", Sub_Category: "Executive Desks", Region: "Asia Pacific", Customer_Segment: "Corporate", Sales: 8400, Profit: 1800, Quantity: 7, Discount: 0.00 },
  { Order_ID: "ORD-1004", Order_Date: "2026-01-25", Category: "Office Supplies", Sub_Category: "Paper & Storage", Region: "North America", Customer_Segment: "Home Office", Sales: 3200, Profit: 950, Quantity: 25, Discount: 0.00 },
  { Order_ID: "ORD-1005", Order_Date: "2026-02-02", Category: "Technology", Sub_Category: "Monitors", Region: "Europe", Customer_Segment: "Corporate", Sales: 14200, Profit: 3800, Quantity: 12, Discount: 0.05 },
  { Order_ID: "ORD-1006", Order_Date: "2026-02-10", Category: "Furniture", Sub_Category: "Ergonomic Chairs", Region: "North America", Customer_Segment: "Consumer", Sales: 9600, Profit: 2100, Quantity: 8, Discount: 0.15 },
  { Order_ID: "ORD-1007", Order_Date: "2026-02-14", Category: "Office Supplies", Sub_Category: "Binders", Region: "Latin America", Customer_Segment: "Home Office", Sales: 2100, Profit: 620, Quantity: 30, Discount: 0.00 },
  { Order_ID: "ORD-1008", Order_Date: "2026-02-22", Category: "Technology", Sub_Category: "Accessories", Region: "Asia Pacific", Customer_Segment: "Consumer", Sales: 6700, Profit: 1900, Quantity: 18, Discount: 0.05 },
  { Order_ID: "ORD-1009", Order_Date: "2026-03-01", Category: "Furniture", Sub_Category: "Tables", Region: "Europe", Customer_Segment: "Corporate", Sales: 11300, Profit: 2400, Quantity: 6, Discount: 0.10 },
  { Order_ID: "ORD-1010", Order_Date: "2026-03-08", Category: "Office Supplies", Sub_Category: "Art & Supplies", Region: "North America", Customer_Segment: "Consumer", Sales: 1800, Profit: 510, Quantity: 22, Discount: 0.00 },
  { Order_ID: "ORD-1011", Order_Date: "2026-03-15", Category: "Technology", Sub_Category: "Smartphones", Region: "Latin America", Customer_Segment: "Corporate", Sales: 15400, Profit: 4100, Quantity: 14, Discount: 0.05 },
  { Order_ID: "ORD-1012", Order_Date: "2026-03-22", Category: "Furniture", Sub_Category: "Bookcases", Region: "Asia Pacific", Customer_Segment: "Home Office", Sales: 7800, Profit: 1650, Quantity: 5, Discount: 0.10 },
  { Order_ID: "ORD-1013", Order_Date: "2026-04-03", Category: "Technology", Sub_Category: "Laptops", Region: "North America", Customer_Segment: "Corporate", Sales: 22500, Profit: 5800, Quantity: 16, Discount: 0.08 },
  { Order_ID: "ORD-1014", Order_Date: "2026-04-11", Category: "Office Supplies", Sub_Category: "Fasteners", Region: "Europe", Customer_Segment: "Consumer", Sales: 1400, Profit: 420, Quantity: 40, Discount: 0.00 },
  { Order_ID: "ORD-1015", Order_Date: "2026-04-19", Category: "Furniture", Sub_Category: "Executive Desks", Region: "North America", Customer_Segment: "Corporate", Sales: 10200, Profit: 2300, Quantity: 9, Discount: 0.05 }
];

const titanicData = [
  { PassengerId: 1, Survived: 0, Pclass: 3, Name: "Braund, Mr. Owen Harris", Sex: "male", Age: 22, SibSp: 1, Parch: 0, Ticket: "A/5 21171", Fare: 7.25, Embarked: "S" },
  { PassengerId: 2, Survived: 1, Pclass: 1, Name: "Cumings, Mrs. John Bradley", Sex: "female", Age: 38, SibSp: 1, Parch: 0, Ticket: "PC 17599", Fare: 71.28, Embarked: "C" },
  { PassengerId: 3, Survived: 1, Pclass: 3, Name: "Heikkinen, Miss. Laina", Sex: "female", Age: 26, SibSp: 0, Parch: 0, Ticket: "STON/O2. 3101282", Fare: 7.925, Embarked: "S" },
  { PassengerId: 4, Survived: 1, Pclass: 1, Name: "Futrelle, Mrs. Jacques Heath", Sex: "female", Age: 35, SibSp: 1, Parch: 0, Ticket: "113803", Fare: 53.1, Embarked: "S" },
  { PassengerId: 5, Survived: 0, Pclass: 3, Name: "Allen, Mr. William Henry", Sex: "male", Age: 35, SibSp: 0, Parch: 0, Ticket: "373450", Fare: 8.05, Embarked: "S" },
  { PassengerId: 6, Survived: 0, Pclass: 3, Name: "Moran, Mr. James", Sex: "male", Age: null, SibSp: 0, Parch: 0, Ticket: "330877", Fare: 8.4583, Embarked: "Q" },
  { PassengerId: 7, Survived: 0, Pclass: 1, Name: "McCarthy, Mr. Timothy J", Sex: "male", Age: 54, SibSp: 0, Parch: 0, Ticket: "17463", Fare: 51.8625, Embarked: "S" },
  { PassengerId: 8, Survived: 1, Pclass: 3, Name: "Johnson, Mrs. Oscar W", Sex: "female", Age: 27, SibSp: 0, Parch: 2, Ticket: "347742", Fare: 11.1333, Embarked: "S" },
  { PassengerId: 9, Survived: 1, Pclass: 2, Name: "Nasser, Mrs. Nicholas", Sex: "female", Age: 14, SibSp: 1, Parch: 0, Ticket: "237736", Fare: 30.0708, Embarked: "C" },
  { PassengerId: 10, Survived: 1, Pclass: 3, Name: "Sandstrom, Miss. Marguerite Rut", Sex: "female", Age: 4, SibSp: 1, Parch: 1, Ticket: "PP 9549", Fare: 16.7, Embarked: "S" }
];

export const sampleDatasets: Dataset[] = [
  {
    id: 'ds_global_sales_2026',
    name: 'Global Enterprise Sales & Revenue',
    description: 'Quarterly sales transactions, region breakdown, margins, and customer segment metrics.',
    currencyCode: 'USD',
    data: salesData,
    summary: profileDataset(salesData),
    uploadedAt: new Date().toISOString(),
    isSample: true,
    aiProfile: {
      overview: 'Comprehensive global sales dataset capturing enterprise technology, office supplies, and executive furniture transactions.',
      businessDomain: 'E-Commerce & Enterprise Sales',
      suggestedQuestions: [
        'What is total sales revenue by product category?',
        'Which region generated highest profit margin?',
        'Compare sales volume across customer segments',
        'Show average discount per category'
      ],
      keyMetrics: ['Total Sales', 'Total Profit', 'Average Order Value', 'Discount Rate'],
      executiveSummary: {
        keyGrowthDrivers: [
          'Technology category drives over 62% of gross revenue with high average order value.',
          'North America leads total regional sales contribution followed by Europe.'
        ],
        operationalRisks: [
          'Furniture category exhibits lower profit margins due to higher discounting.'
        ],
        topPerformingSegments: ['Corporate Segment', 'Technology Category', 'North America Region'],
        strategicRecommendations: [
          'Optimize discount structure on Furniture lines to safeguard operating margins.',
          'Expand corporate segment outreach in Asia Pacific.'
        ]
      }
    }
  },
  {
    id: 'ds_titanic_passengers',
    name: 'Titanic Passenger Demographics',
    description: 'Historical passenger registry, class hierarchy, demographics, fares, and survival records.',
    data: titanicData,
    summary: profileDataset(titanicData),
    uploadedAt: new Date().toISOString(),
    isSample: true,
    aiProfile: {
      overview: 'Demographic and survival data for Titanic passengers.',
      businessDomain: 'Historical Demographics & Classification',
      suggestedQuestions: [
        'Show survival count by passenger class (Pclass)',
        'Compare survival count between males and females',
        'Show average Fare grouped by Survived status',
        'Show top 10 passengers with highest Fare'
      ],
      keyMetrics: ['Total Passengers', 'Survival Rate', 'Average Age', 'Average Fare'],
      executiveSummary: {
        keyGrowthDrivers: ['First-class passengers enjoyed higher survival probability.'],
        operationalRisks: ['Cabin missing values require imputation.'],
        topPerformingSegments: ['First Class Passengers', 'Female Passengers'],
        strategicRecommendations: ['Analyze interaction between class and survival outcome.']
      }
    }
  }
];
