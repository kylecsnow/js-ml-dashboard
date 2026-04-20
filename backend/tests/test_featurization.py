import pandas as pd

from featurization import get_mordred_features


def test_get_mordred_features_coerces_non_numeric_values(monkeypatch):
    class FakeCalculator:
        def __init__(self, _descriptors, ignore_3D):
            assert ignore_3D is True

        def pandas(self, mol_list):
            assert mol_list == ["mol_a", "mol_b"]
            return pd.DataFrame(
                {
                    "num_as_text": ["1.5", "2.0"],
                    "invalid": ["bad", "3.5"],
                }
            )

    monkeypatch.setattr("featurization.Calculator", FakeCalculator)

    features = get_mordred_features(["mol_a", "mol_b"])

    assert list(features.columns) == ["num_as_text", "invalid"]
    assert features["num_as_text"].tolist() == [1.5, 2.0]
    assert pd.isna(features.loc[0, "invalid"])
    assert features.loc[1, "invalid"] == 3.5
