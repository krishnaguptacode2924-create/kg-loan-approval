def KG_Loan_Prediction(Input_Data):
    import numpy as np
    import pandas as pd
    import joblib as jb
    
    from pathlib import Path
    
    BASE_DIR = Path(__file__).resolve().parent
    ARTIFACT_DIR = BASE_DIR / "KG_Loan_Artifacts"
    
    scaler = jb.load(ARTIFACT_DIR / "KG_Loan_Scaler.pkl")
    model = jb.load(ARTIFACT_DIR / "KG_Loan_Predictor.pkl")

    df = pd.DataFrame([Input_Data])

    #For Female feature; convert input Female/Male to feature values 1/0
    df["Female"] = df["Female"].map({"Female": 1, "Male": 0})

    #For Married feature; convert input Married/Single to feature values 1/0
    df["Married"] = df["Married"].map({"Married": 1, "Single": 0})

    #For Graduate feature; convert input Yes/No to feature values 1/0
    df["Graduate"] = df["Graduate"].map({"Yes": 1, "No": 0})

    #For Self_Employed feature; convert input Yes/No to feature values 1/0
    df["Self_Employed"] = df["Self_Employed"].map({"Yes": 1, "No": 0})

    #For Credit feature; convert input >=700 -> 1 and <700 -> 0
    df["Credit"] = np.where(df["Credit"] >= 700, 1, 0)

    #For Property feature; convert input to urban, semiurban and rural
    df["Rural"] = (df["Property"] == "Rural").astype(int)
    df["Semiurban"] = (df["Property"] == "Semiurban").astype(int)
    df["Urban"] = (df["Property"] == "Urban").astype(int)
    df.drop(columns=["Property"], inplace=True)

    #For numeric features, scale input using scaler object
    df["Dependents"] = df["Dependents"].clip(upper=3)
    df["LoanAmount"] = df["LoanAmount"] / 1000
    num_col = ['Dependents', 'ApplicantIncome', 'CoapplicantIncome', 'LoanAmount', 'Term']
    df[num_col] = scaler.transform(df[num_col])

    #Predictio
    result = model.predict(df)
    probabilities = model.predict_proba(df)[0]
    confidence = max(probabilities) * 100

    return {
        "Prediction": int(result[0]),
        "Confidence_score": round(float(confidence), 2)
    }