"""PostgreSQL adapter tests (Task 7)."""

from app.adapters import (
    PostgreSQLAdapter,
    get_adapter,
    iter_plan_nodes,
    list_adapters,
    parse_pg_explain_json,
)


class TestPostgreSQLAdapterRegistration:
    """Tests for PostgreSQL adapter registration."""

    def test_postgresql_adapter_registered(self):
        """PostgreSQL adapter should be registered by default."""
        adapters = list_adapters()
        assert "postgresql" in adapters

    def test_get_adapter_returns_postgresql_class(self):
        """get_adapter should return PostgreSQLAdapter class."""
        adapter_class = get_adapter("postgresql")
        assert adapter_class is PostgreSQLAdapter

    def test_dialect_attributes(self):
        """Test dialect attributes."""
        adapter = PostgreSQLAdapter({})
        assert adapter.dialect_name == "postgresql"
        assert adapter.driver_name == "asyncpg"
        assert adapter.default_port == 5432


class TestParsePGExplainJSON:
    """Tests for parse_pg_explain_json pure function."""

    def test_parse_simple_seq_scan(self):
        """Parse a simple Seq Scan plan."""
        plan_json = [{
            "Plan": {
                "Node Type": "Seq Scan",
                "Relation Name": "users",
                "Alias": "u",
                "Startup Cost": 0.00,
                "Total Cost": 15.50,
                "Plan Rows": 500,
                "Plan Width": 68,
                "Actual Startup Time": 0.012,
                "Actual Total Time": 0.045,
                "Actual Rows": 500,
                "Actual Loops": 1,
                "Filter": "(email IS NOT NULL)",
                "Rows Removed by Filter": 0,
            }
        }]

        result = parse_pg_explain_json(plan_json)

        assert result.estimated_cost == 15.50
        assert result.estimated_rows == 500
        assert len(result.operations) == 1
        op = result.operations[0]
        assert op["Node Type"] == "Seq Scan"
        assert op["Relation Name"] == "users"
        assert op["Filter"] == "(email IS NOT NULL)"

    def test_parse_hash_join_plan(self):
        """Parse a Hash Join plan with two Seq Scans."""
        plan_json = [{
            "Plan": {
                "Node Type": "Hash Join",
                "Startup Cost": 25.00,
                "Total Cost": 125.00,
                "Plan Rows": 100,
                "Plan Width": 136,
                "Actual Startup Time": 0.050,
                "Actual Total Time": 0.120,
                "Actual Rows": 100,
                "Actual Loops": 1,
                "Hash Cond": "(orders.user_id = users.id)",
                "Plans": [
                    {
                        "Node Type": "Seq Scan",
                        "Parent Relationship": "Outer",
                        "Relation Name": "orders",
                        "Alias": "o",
                        "Startup Cost": 0.00,
                        "Total Cost": 20.00,
                        "Plan Rows": 1000,
                        "Plan Width": 72,
                        "Actual Startup Time": 0.010,
                        "Actual Total Time": 0.040,
                        "Actual Rows": 1000,
                        "Actual Loops": 1,
                    },
                    {
                        "Node Type": "Hash",
                        "Parent Relationship": "Inner",
                        "Startup Cost": 15.00,
                        "Total Cost": 15.00,
                        "Plan Rows": 500,
                        "Plan Width": 68,
                        "Actual Startup Time": 0.020,
                        "Actual Total Time": 0.030,
                        "Actual Rows": 500,
                        "Actual Loops": 1,
                        "Plans": [
                            {
                                "Node Type": "Seq Scan",
                                "Parent Relationship": "Outer",
                                "Relation Name": "users",
                                "Alias": "u",
                                "Startup Cost": 0.00,
                                "Total Cost": 15.00,
                                "Plan Rows": 500,
                                "Plan Width": 68,
                                "Actual Startup Time": 0.010,
                                "Actual Total Time": 0.025,
                                "Actual Rows": 500,
                                "Actual Loops": 1,
                            }
                        ]
                    }
                ]
            }
        }]

        result = parse_pg_explain_json(plan_json)

        assert result.estimated_cost == 125.00
        assert result.estimated_rows == 100
        assert len(result.operations) == 4  # Hash Join + Seq Scan (orders) + Hash + Seq Scan (users)

        # Check node types
        node_types = [op["Node Type"] for op in result.operations]
        assert "Hash Join" in node_types
        assert node_types.count("Seq Scan") == 2
        assert "Hash" in node_types

        # Check Hash Join details
        hash_join = next(op for op in result.operations if op["Node Type"] == "Hash Join")
        assert hash_join["Hash Cond"] == "(orders.user_id = users.id)"
        assert "Join Type" not in hash_join  # Not specified in this example

    def test_parse_index_scan_plan(self):
        """Parse an Index Scan plan."""
        plan_json = [{
            "Plan": {
                "Node Type": "Index Scan",
                "Relation Name": "users",
                "Alias": "u",
                "Index Name": "idx_users_email",
                "Startup Cost": 0.28,
                "Total Cost": 8.30,
                "Plan Rows": 1,
                "Plan Width": 68,
                "Actual Startup Time": 0.008,
                "Actual Total Time": 0.015,
                "Actual Rows": 1,
                "Actual Loops": 1,
                "Index Cond": "(email = 'test@example.com'::text)",
                "Filter": "(is_active = true)",
            }
        }]

        result = parse_pg_explain_json(plan_json)

        assert result.estimated_cost == 8.30
        assert result.estimated_rows == 1
        assert len(result.operations) == 1
        op = result.operations[0]
        assert op["Node Type"] == "Index Scan"
        assert op["Relation Name"] == "users"
        assert op["Index Cond"] == "(email = 'test@example.com'::text)"
        assert op["Filter"] == "(is_active = true)"

    def test_parse_sort_plan(self):
        """Parse a Sort plan."""
        plan_json = [{
            "Plan": {
                "Node Type": "Sort",
                "Startup Cost": 50.00,
                "Total Cost": 55.00,
                "Plan Rows": 100,
                "Plan Width": 136,
                "Actual Startup Time": 0.080,
                "Actual Total Time": 0.120,
                "Actual Rows": 100,
                "Actual Loops": 1,
                "Sort Key": ["created_at DESC"],
                "Sort Method": "quicksort",
                "Sort Space Used": 25,
                "Sort Space Type": "Memory",
                "Plans": [
                    {
                        "Node Type": "Seq Scan",
                        "Relation Name": "orders",
                        "Startup Cost": 0.00,
                        "Total Cost": 20.00,
                        "Plan Rows": 100,
                        "Plan Width": 136,
                    }
                ]
            }
        }]

        result = parse_pg_explain_json(plan_json)

        assert len(result.operations) == 2
        node_types = [op["Node Type"] for op in result.operations]
        assert "Sort" in node_types
        assert "Seq Scan" in node_types

        sort_op = next(op for op in result.operations if op["Node Type"] == "Sort")
        assert sort_op["Sort Key"] == ["created_at DESC"]
        assert sort_op["Sort Method"] == "quicksort"

    def test_parse_empty_plan(self):
        """Parse empty plan returns empty QueryPlan."""
        result = parse_pg_explain_json([])
        assert result.operations == []
        assert result.estimated_cost is None
        assert result.estimated_rows is None

    def test_parse_plan_without_actual_timing(self):
        """Parse plan without actual timing (EXPLAIN without ANALYZE)."""
        plan_json = [{
            "Plan": {
                "Node Type": "Seq Scan",
                "Relation Name": "users",
                "Startup Cost": 0.00,
                "Total Cost": 15.50,
                "Plan Rows": 500,
                "Plan Width": 68,
            }
        }]

        result = parse_pg_explain_json(plan_json)

        assert result.estimated_cost == 15.50
        assert result.estimated_rows == 500
        op = result.operations[0]
        assert "Actual Startup Time" not in op
        assert "Actual Total Time" not in op
        assert "Actual Rows" not in op


class TestIterPlanNodes:
    """Tests for iter_plan_nodes pure function."""

    def test_iter_simple_plan(self):
        """Iterate through a simple plan."""
        plan_dict = {
            "Node Type": "Seq Scan",
            "Relation Name": "users",
            "Total Cost": 15.50,
            "Plan Rows": 500,
        }

        nodes = iter_plan_nodes(plan_dict)

        assert len(nodes) == 1
        assert nodes[0]["Node Type"] == "Seq Scan"
        assert nodes[0]["Relation Name"] == "users"
        assert nodes[0]["Total Cost"] == 15.50
        assert nodes[0]["Plan Rows"] == 500

    def test_iter_nested_plan(self):
        """Iterate through a nested plan (Hash Join with children)."""
        plan_dict = {
            "Node Type": "Hash Join",
            "Total Cost": 125.00,
            "Plan Rows": 100,
            "Hash Cond": "(orders.user_id = users.id)",
            "Plans": [
                {
                    "Node Type": "Seq Scan",
                    "Parent Relationship": "Outer",
                    "Relation Name": "orders",
                    "Total Cost": 20.00,
                    "Plan Rows": 1000,
                },
                {
                    "Node Type": "Hash",
                    "Parent Relationship": "Inner",
                    "Total Cost": 15.00,
                    "Plan Rows": 500,
                    "Plans": [
                        {
                            "Node Type": "Seq Scan",
                            "Parent Relationship": "Outer",
                            "Relation Name": "users",
                            "Total Cost": 15.00,
                            "Plan Rows": 500,
                        }
                    ]
                }
            ]
        }

        nodes = iter_plan_nodes(plan_dict)

        assert len(nodes) == 4
        node_types = [n["Node Type"] for n in nodes]
        assert node_types == ["Hash Join", "Seq Scan", "Hash", "Seq Scan"]

        # Check that all nodes have the expected fields
        for node in nodes:
            assert "Node Type" in node
            assert node["Node Type"] is not None

    def test_iter_plan_preserves_important_fields(self):
        """Test that iter_plan_nodes preserves important fields."""
        plan_dict = {
            "Node Type": "Seq Scan",
            "Relation Name": "users",
            "Alias": "u",
            "Startup Cost": 0.00,
            "Total Cost": 15.50,
            "Plan Rows": 500,
            "Plan Width": 68,
            "Actual Startup Time": 0.012,
            "Actual Total Time": 0.045,
            "Actual Rows": 500,
            "Actual Loops": 1,
            "Filter": "(email IS NOT NULL)",
            "Index Cond": "(id > 100)",
        }

        nodes = iter_plan_nodes(plan_dict)

        assert len(nodes) == 1
        node = nodes[0]
        assert node["Alias"] == "u"
        assert node["Startup Cost"] == 0.00
        assert node["Total Cost"] == 15.50
        assert node["Filter"] == "(email IS NOT NULL)"
        assert node["Index Cond"] == "(id > 100)"
        assert node["Actual Startup Time"] == 0.012
        assert node["Actual Total Time"] == 0.045
        assert node["Actual Rows"] == 500

    def test_iter_plan_handles_none_input(self):
        """iter_plan_nodes handles None input gracefully."""
        nodes = iter_plan_nodes(None)
        assert nodes == []

    def test_iter_plan_handles_empty_dict(self):
        """iter_plan_nodes handles empty dict gracefully."""
        nodes = iter_plan_nodes({})
        assert nodes == []


class TestPostgreSQLAdapterBuildConnectionString:
    """Tests for build_connection_string method."""

    def test_build_connection_string(self):
        """Test building connection string from config."""
        adapter = PostgreSQLAdapter({})
        config = {
            "username": "testuser",
            "password": "testpass",
            "host": "localhost",
            "port": 5432,
            "database_name": "testdb",
        }
        conn_str = adapter.build_connection_string(config)
        assert "user=testuser" in conn_str
        assert "password=testpass" in conn_str
        assert "host=localhost" in conn_str
        assert "port=5432" in conn_str
        assert "dbname=testdb" in conn_str

    def test_get_type_mapping(self):
        """Test type mapping."""
        adapter = PostgreSQLAdapter({})
        mapping = adapter.get_type_mapping()
        assert mapping["integer"] == "integer"
        assert mapping["text"] == "text"
        assert mapping["timestamp"] == "datetime"
        assert mapping["uuid"] == "uuid"
        assert mapping["jsonb"] == "json"