from mordred import Calculator, descriptors
import pandas as pd

def get_mordred_features(mol_list):
    calc = Calculator(descriptors, ignore_3D=True)
    mordred_results = calc.pandas(mol_list)
    mordred_features = mordred_results.apply(pd.to_numeric, errors='coerce')
    return mordred_features
