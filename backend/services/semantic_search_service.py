import re
from typing import Dict, Any, List, Tuple
from difflib import SequenceMatcher


def _similarity_ratio(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


class SemanticSearchService:
    """
    Semantic Column & Keyword Resolver.
    Maps user natural language terms (e.g. 'revenue', 'client', 'location')
    to actual dataset column names (e.g. 'Sales', 'CustomerName', 'Region').
    """

    SYNONYM_DICTIONARY = {
        "revenue": ["sales", "total_sales", "amount", "gross_sales", "income", "turnover"],
        "sales": ["revenue", "amount", "price", "subtotal", "total"],
        "earnings": ["profit", "net_profit", "sales", "revenue", "margin"],
        "client": ["customer", "customername", "clientname", "buyer", "customer_id", "company"],
        "customer": ["client", "customername", "buyer", "user", "client_id"],
        "profit": ["margin", "net_profit", "earnings", "gross_margin", "return"],
        "location": ["region", "country", "city", "state", "territory", "area", "address"],
        "region": ["location", "territory", "zone", "state", "country", "area"],
        "southern": ["south", "region", "location"],
        "date": ["order_date", "timestamp", "created_at", "time", "day", "transaction_date", "month", "year"],
        "product": ["item", "product_name", "sku", "category", "merchandise", "description"],
        "cost": ["price", "discount", "expense", "fee"],
        "quantity": ["units", "qty", "count", "items_sold", "volume"],
        "discount": ["discountpercent", "discount", "disc", "rebate", "percent"],
        "rating": ["rating", "score", "stars", "review"],
        "returned": ["returned", "refunded", "return", "status"]
    }

    def resolve_column_mappings(
        self,
        query: str,
        column_names: List[str],
        column_aliases: Dict[str, List[str]] = None
    ) -> Dict[str, Tuple[str, float]]:
        """
        Returns a mapping dictionary of {matched_user_term: (actual_column_name, confidence_score)}.
        """
        words = re.findall(r'\b[a-zA-Z0-9_]+\b', query.lower())
        mappings: Dict[str, Tuple[str, float]] = {}

        for word in words:
            if len(word) < 3:
                continue

            best_match: str = ""
            best_score: float = 0.0

            for col in column_names:
                clean_col = col.lower().replace("_", "").replace("-", "").replace(" ", "")
                clean_word = word.replace("_", "").replace("-", "").replace(" ", "")

                # Exact match or substring match
                if clean_word == clean_col:
                    best_match = col
                    best_score = 1.0
                    break
                elif clean_word in clean_col or clean_col in clean_word:
                    score = 0.85
                    if score > best_score:
                        best_match = col
                        best_score = score

                # Check synonym dictionary
                synonyms = self.SYNONYM_DICTIONARY.get(clean_word, [])
                for syn in synonyms:
                    if syn in clean_col or clean_col in syn:
                        score = 0.90
                        if score > best_score:
                            best_match = col
                            best_score = score

                # Check column aliases if provided
                if column_aliases and col in column_aliases:
                    for alias in column_aliases[col]:
                        alias_clean = alias.replace(" ", "").replace("_", "")
                        if clean_word == alias_clean or clean_word in alias_clean:
                            score = 0.88
                            if score > best_score:
                                best_match = col
                                best_score = score

                # Sequence matcher similarity ratio
                ratio = _similarity_ratio(word, col)
                if ratio > 0.75 and ratio > best_score:
                    best_match = col
                    best_score = ratio

            if best_match and best_score >= 0.75:
                mappings[word] = (best_match, round(best_score, 2))

        return mappings


semantic_search_service = SemanticSearchService()
