import os
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from KG_Loan_Predict_Module import KG_Loan_Prediction

BASE_DIR = Path(__file__).resolve().parent
UI_DIR = BASE_DIR / "KG_Loan_UI"

app = FastAPI(title="KG Loan Approval")


class LoanInput(BaseModel):
    Female: str
    Married: str
    Dependents: int = Field(ge=0)
    Graduate: str
    Self_Employed: str
    ApplicantIncome: float = Field(ge=0)
    CoapplicantIncome: float = Field(ge=0)
    LoanAmount: float = Field(gt=0)
    Term: int = Field(gt=0)
    Credit: int = Field(ge=0)
    Property: str


@app.get("/health")
def health():
    return {"message": "KG Loan Approval API is running"}


@app.post("/predict")
def predict(data: LoanInput):
    return KG_Loan_Prediction(data.model_dump())


# Must stay LAST: serves the UI at "/" (index.html, styles.css, app.js).
# API routes above take priority because they are registered first.
app.mount("/", StaticFiles(directory=UI_DIR, html=True), name="ui")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
