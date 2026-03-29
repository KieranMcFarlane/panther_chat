type HttpMethod = 'POST' | 'GET';

export interface LeadIqClientOptions {
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  authHeaderName?: string;
  authPrefix?: string;
}

export interface LeadIqCompanySearchInput {
  company_name?: string;
  company_domain?: string;
  country_code?: string;
  linkedin_url?: string;
  linkedin_id?: string;
  strict?: boolean;
}

export interface LeadIqPeopleSearchInput {
  title?: string;
  company_name?: string;
  company_domain?: string;
  country_code?: string;
  seniority?: string[];
  roles?: string[];
  limit?: number;
  skip?: number;
}

export interface LeadIqFeedbackInput {
  personId?: string;
  linkedinUrl?: string;
  linkedinId?: string;
  name?: string;
  companyId?: string;
  companyName?: string;
  companyDomain?: string;
  title?: string;
  status: 'bad' | 'good';
  reason: string;
}

const SEARCH_COMPANY_QUERY = `
  query SearchCompany($input: SearchCompanyInput!) {
    searchCompany(input: $input) {
      totalResults
      hasMore
      results {
        id
        name
        domain
        description
        linkedinId
        linkedinUrl
        numberOfEmployees
        industry
        specialities
        fundingInfo {
          fundingRounds
          fundingTotalUsd
          lastFundingOn
          lastFundingType
          lastFundingUsd
        }
        locationInfo {
          formattedAddress
          city
          country
          countryCode2
          countryCode3
        }
        companyHierarchy
        updatedDate
      }
    }
  }
`;

const FLAT_ADVANCED_SEARCH_QUERY = `
  query FlatAdvancedSearch($input: FlatSearchInput!) {
    flatAdvancedSearch(input: $input) {
      totalPeople
      people {
        id
        companyId
        name
        title
        role
        city
        state
        country
        countryCode2
        countryCode3
        seniority
        workEmails
        verifiedWorkEmails
        verifiedLikelyWorkEmails
        currentPositionStartDate
        company {
          id
          name
          domain
          employeeCount
          industry
          description
          companyTechnologies
          companyTechnologyCategories
        }
      }
    }
  }
`;

const GROUPED_ADVANCED_SEARCH_QUERY = `
  query GroupedAdvancedSearch($input: GroupedSearchInput!) {
    groupedAdvancedSearch(input: $input) {
      totalCompanies
      companies {
        company {
          id
          name
          domain
          employeeCount
          industry
          description
          companyTechnologies
          companyTechnologyCategories
        }
        totalContactsInCompany
      }
    }
  }
`;

const SUBMIT_PERSON_FEEDBACK_MUTATION = `
  mutation SubmitPersonFeedback($input: ApiPersonFeedback!) {
    submitPersonFeedback(input: $input)
  }
`;

function normalizeArray(input: unknown): string[] {
  return Array.isArray(input) ? input.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
}

function asTrimmedString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

export class LeadIqClient {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly authHeaderName: string;
  private readonly authPrefix: string;

  constructor(options: LeadIqClientOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.LEADIQ_API_KEY ?? process.env.LEADIQ_KEY;
    this.baseUrl = options.baseUrl ?? process.env.LEADIQ_API_BASE_URL ?? 'https://api.leadiq.com/graphql';
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.authHeaderName = options.authHeaderName ?? process.env.LEADIQ_AUTH_HEADER_NAME ?? 'Authorization';
    this.authPrefix = options.authPrefix ?? process.env.LEADIQ_AUTH_PREFIX ?? 'Bearer';
  }

  buildCompanySearchRequest(input: LeadIqCompanySearchInput) {
    const query = {
      company_name: asTrimmedString(input.company_name),
      company_domain: asTrimmedString(input.company_domain),
      country_code: asTrimmedString(input.country_code),
      linkedin_url: asTrimmedString(input.linkedin_url),
      linkedin_id: asTrimmedString(input.linkedin_id),
      strict: input.strict ?? true,
    };

    return {
      operationName: 'SearchCompany',
      query,
      graphql: {
        query: SEARCH_COMPANY_QUERY,
        variables: {
          input: {
            name: query.company_name,
            domain: query.company_domain,
            linkedinUrl: query.linkedin_url,
            linkedinId: query.linkedin_id,
            strict: query.strict,
          },
        },
      },
    };
  }

  buildFlatAdvancedSearchRequest(input: LeadIqPeopleSearchInput) {
    const query = {
      title: asTrimmedString(input.title),
      company_name: asTrimmedString(input.company_name),
      company_domain: asTrimmedString(input.company_domain),
      country_code: asTrimmedString(input.country_code),
      seniority: normalizeArray(input.seniority),
      roles: normalizeArray(input.roles),
      limit: input.limit ?? 25,
      skip: input.skip ?? 0,
    };

    return {
      operationName: 'FlatAdvancedSearch',
      query,
      graphql: {
        query: FLAT_ADVANCED_SEARCH_QUERY,
        variables: {
          input: {
            limit: query.limit,
            skip: query.skip,
            contactFilter: {
              titles: query.title ? [query.title] : undefined,
              seniorities: query.seniority.length ? query.seniority : undefined,
              roles: query.roles.length ? query.roles : undefined,
              locations: query.country_code ? [{ country: query.country_code }] : undefined,
            },
            companyFilter: {
              name: query.company_name,
              domain: query.company_domain,
            },
          },
        },
      },
    };
  }

  buildGroupedAdvancedSearchRequest(input: LeadIqPeopleSearchInput) {
    const query = {
      title: asTrimmedString(input.title),
      company_name: asTrimmedString(input.company_name),
      company_domain: asTrimmedString(input.company_domain),
      country_code: asTrimmedString(input.country_code),
      seniority: normalizeArray(input.seniority),
      roles: normalizeArray(input.roles),
      limit: input.limit ?? 25,
      skip: input.skip ?? 0,
    };

    return {
      operationName: 'GroupedAdvancedSearch',
      query,
      graphql: {
        query: GROUPED_ADVANCED_SEARCH_QUERY,
        variables: {
          input: {
            limit: query.limit,
            skip: query.skip,
            contactFilter: {
              titles: query.title ? [query.title] : undefined,
              seniorities: query.seniority.length ? query.seniority : undefined,
              roles: query.roles.length ? query.roles : undefined,
              locations: query.country_code ? [{ country: query.country_code }] : undefined,
            },
            companyFilter: {
              name: query.company_name,
              domain: query.company_domain,
            },
          },
        },
      },
    };
  }

  buildPersonFeedbackRequest(input: LeadIqFeedbackInput) {
    const body = {
      personId: asTrimmedString(input.personId),
      linkedinUrl: asTrimmedString(input.linkedinUrl),
      linkedinId: asTrimmedString(input.linkedinId),
      name: asTrimmedString(input.name),
      companyId: asTrimmedString(input.companyId),
      companyName: asTrimmedString(input.companyName),
      companyDomain: asTrimmedString(input.companyDomain),
      title: asTrimmedString(input.title),
      status: input.status === 'bad' ? 'Invalid' : 'Correct',
      value: input.reason,
    };

    return {
      operationName: 'SubmitPersonFeedback',
      body,
      graphql: {
        query: SUBMIT_PERSON_FEEDBACK_MUTATION,
        variables: { input: body },
      },
    };
  }

  async searchCompany(input: LeadIqCompanySearchInput) {
    return this.request(this.buildCompanySearchRequest(input), 'searchCompany');
  }

  async flatAdvancedSearch(input: LeadIqPeopleSearchInput) {
    return this.request(this.buildFlatAdvancedSearchRequest(input), 'flatAdvancedSearch');
  }

  async groupedAdvancedSearch(input: LeadIqPeopleSearchInput) {
    return this.request(this.buildGroupedAdvancedSearchRequest(input), 'groupedAdvancedSearch');
  }

  async submitPersonFeedback(input: LeadIqFeedbackInput) {
    return this.request(this.buildPersonFeedbackRequest(input), 'submitPersonFeedback');
  }

  private async request(
    builtRequest: { graphql: { query: string; variables: Record<string, unknown> }; operationName: string },
    responseKey: string,
  ) {
    const response = await this.fetchImpl(this.baseUrl, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({
        operationName: builtRequest.operationName,
        query: builtRequest.graphql.query,
        variables: builtRequest.graphql.variables,
      }),
    });

    if (!response.ok) {
      throw new Error(`LeadIQ request failed: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    if (json.errors?.length) {
      throw new Error(json.errors[0]?.message ?? 'LeadIQ GraphQL error');
    }

    return json.data?.[responseKey];
  }

  private buildHeaders() {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };

    if (this.apiKey) {
      headers[this.authHeaderName] = this.authPrefix ? `${this.authPrefix} ${this.apiKey}` : this.apiKey;
    }

    return headers;
  }
}
