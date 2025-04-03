declare module '@revenuecat/purchases-js' {
  export interface CustomerInfo {
    entitlements: {
      active: Record<string, EntitlementInfo>;
      all: Record<string, EntitlementInfo>;
    };
    originalAppUserId?: string;
    managementURL?: string;
  }

  export interface EntitlementInfo {
    identifier: string;
    isActive: boolean;
    willRenew: boolean;
    periodType: string;
    latestPurchaseDate: string;
    originalPurchaseDate: string;
    expirationDate: string | null;
    store: string;
    productIdentifier: string;
    isSandbox: boolean;
  }

  export interface Package {
    identifier: string;
    packageType: string;
    product: Product;
    offering: string;
  }

  export interface Product {
    identifier: string;
    description: string;
    title: string;
    price: number;
    priceString: string;
    currencyCode: string;
  }

  export interface Offering {
    identifier: string;
    description: string;
    packages: Package[];
  }

  export interface Offerings {
    current: Offering | null;
    all: Record<string, Offering>;
  }

  export class Purchases {
    static configure(apiKey: string, appUserID?: string): Promise<void>;
    static getCustomerInfo(): Promise<CustomerInfo>;
    static getOfferings(): Promise<Offerings>;
    static purchasePackage(pkg: Package): Promise<{ customerInfo: CustomerInfo }>;
  }
} 