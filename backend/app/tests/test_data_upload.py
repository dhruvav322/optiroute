def test_data_upload_inserts_records(client, test_db):
    csv_content = b"date,quantity\n2024-01-01,10\n2024-01-02,12\n"

    response = client.post("/data/upload", files={"file": ("sales.csv", csv_content, "text/csv")})
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "uploaded"
    assert payload["records_added"] == 2
    assert test_db.historical_sales.count_documents({}) == 2


def test_data_upload_rejects_invalid_csv(client):
    response = client.post("/data/upload", files={"file": ("bad.csv", b"date,qty\n", "text/csv")})
    assert response.status_code == 400
    assert "CSV must include" in response.json()["detail"]
