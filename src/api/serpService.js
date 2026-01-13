import axios from "axios";
import { lookupMarketValuesByn8n } from "./n8nService";

const SERP_API_KEY = import.meta.env.VITE_SERP_API_KEY;

// Helper function to create search queries based on item details
const createSearchQuery = (item, source) => {
  const { name, expiration_date, uom } = item;
  let query = `${name} `;
  
  // if (expiration_date) {
  //   query += ` expiration ${expiration_date} `;
  // }
  
  // if (uom) {
  //   query += ` uom ${uom} `;
  // }
  
  // Add site-specific search parameters
  switch (source) {
    case "synergysurgical.com":
      return { query, site: "synergysurgical.com" };
    case "westcmr.com":
      return { query, site: "westcmr.com" };
    case "geosurgical.com":
      return { query, site: "geosurgical.com" };
    case "dotmed.com":
      return { query, site: "dotmed.com" };
    case "shopsps.com":
      return { query, site: "shopsps.com" };
    default:
      return { query };
  }
};

// Function to extract price from search results
const extractPrice = (result) => {
  try {
    // Look for price in various formats
    const priceRegex = /\$\s?(\d+(?:,\d+)?(?:\.\d+)?)/;
    
    // Check title and snippet for price
    const title = result.title || "";
    const snippet = result.snippet || "";
    
    const titleMatch = title.match(priceRegex);
    const snippetMatch = snippet.match(priceRegex);
    
    if (titleMatch) {
      return parseFloat(titleMatch[1].replace(/,/g, ""));
    }
    
    if (snippetMatch) {
      return parseFloat(snippetMatch[1].replace(/,/g, ""));
    }
    
    return null;
  } catch (error) {
    console.error("Error extracting price:", error);
    return null;
  }
};

// Main function to look up market values using SERP API
export const lookupMarketValues = async (items, sources = ["synergysurgical.com", "dotmed.com"]) => {
  try {
    const results = [];
    
    for (const item of items) {
      const itemResults = {
        name: item.name,
        sku: item.sku,
        expiration_date: item.expiration_date,
        uom: item.uom,
        sources: []
      };
      
      // Search each source
      for (const source of sources) {
        const { query, site } = createSearchQuery(item, source);

        
        try {
          const response = await lookupMarketValuesByn8n(query + "site:" + site , site, SERP_API_KEY);
          
          if (response.data && response.data.organic_results) {
            const organicResults = response.data.organic_results;
            const priceData = [];
            
            for (const result of organicResults) {
              const price = result.rich_snippet?.bottom.detected_extensions?.price;
              if (price) {
                priceData.push({
                  title: result.title,
                  link: result.link,
                  price: price
                });
              }
            }
            
            // Calculate average price if we found any
            let avgPrice = null;
            if (priceData.length > 0) {
              avgPrice = priceData.reduce((sum, item) => sum + item.price, 0) / priceData.length;
            }
            
            itemResults.sources.push({
              source: site,
              found: priceData.length > 0,
              results_count: priceData.length,
              price_data: priceData,
              average_price: avgPrice,
            });
          }
        } catch (error) {
          console.error(`Error searching ${source}:`, error);
          itemResults.sources.push({
            source,
            found: false,
            error: error.message
          });
        }
      }
      
      // Calculate overall average price across all sources
      const validPrices = itemResults.sources
        .filter(source => source.average_price)
        .map(source => source.average_price);
      
      if (validPrices.length > 0) {
        itemResults.average_market_price = validPrices.reduce((sum, price) => sum + price, 0) / validPrices.length;
      }
      
      results.push(itemResults);
    }
    
    return {
      success: true,
      results,
      message: `Found market values for ${results.filter(r => r.average_market_price).length} out of ${items.length} items`
    };
  } catch (error) {
    console.error("Error looking up market values:", error);
    return {
      success: false,
      error: error.message,
      message: "Failed to look up market values. Please try again later."
    };
  }
};
