import base64
from io import BytesIO
import numpy as np
from rdkit import Chem
from rdkit.Chem import AllChem, Draw, MolFromSmiles
import pandas as pd
import plotly.graph_objects as go
from sklearn.preprocessing import StandardScaler
from umap import UMAP



### TODO: is this part even necessary???  Won't always want to have this hard-coded.....
from enum import Enum
class ColumnName(str, Enum):
    column_one_name = "column 1"
    column_two_name = "column 2"


# Generate molecule images as base64 encoded strings
def smiles_to_base64(smiles, size=(300, 300)):
    """Convert SMILES string to base64 encoded image"""

    mol = MolFromSmiles(smiles)
    img = Draw.MolToImage(mol, size=size)
    buffer = BytesIO()
    img.save(buffer, format="png")
    for_encoding = buffer.getvalue()
    
    return 'data:image/png;base64,' + base64.b64encode(for_encoding).decode()


def process_molecular_space_map_data(df, featurization_method='morgan'):
    """
    Create an interactive 2D scatter plot of molecules in chemical space using Bokeh.
    
    Parameters:
    -----------
    smiles_df : DataFrame containing a column of SMILES strings, which must contain a column named "SMILES"
        List of molecular structures to visualize
    featurization_method : str, optional (default='morgan')
        Method to convert molecules to feature vectors
    
    Returns:
    --------
    bokeh.plotting.Figure: Interactive molecular space visualization
    """

    smiles = df["SMILES"].tolist()
    group = df["Group"].tolist()
    molecules = [Chem.MolFromSmiles(smi) for smi in smiles]

    # Featurize molecules
    if featurization_method == 'morgan':
        features = [AllChem.GetMorganFingerprintAsBitVect(mol, 2, nBits=2048) 
                    for mol in molecules]
        features = np.array([list(x.ToBitString()) for x in features], dtype=float)

    elif featurization_method == 'descriptors':
        features = np.array([
            AllChem.CalcMolDescriptors(mol)
            for mol in molecules
        ])

    else:
        raise ValueError("Invalid featurization method")


    # Standardize features
    scaler = StandardScaler()
    features_scaled = scaler.fit_transform(features)

    reducer = UMAP(
        n_components=2,
        n_neighbors=15,
        min_dist=0.1,
        random_state=42
    )
    embedding = reducer.fit_transform(features_scaled)

    # Prepare molecule images and SMILES
    # mol_images = [mol_to_base64(mol) for mol in molecules]

    mol_images_df = df
    mol_images_df["UMAP1"] = embedding[:, 0]
    mol_images_df["UMAP2"] = embedding[:, 1]
    # mol_images_df['Image'] = mol_images
    # data=dict(
    #     x=embedding[:, 0],
    #     y=embedding[:, 1],
    #     smiles=smiles,
    #     group=group,
    #     images=mol_images
    # )

    return mol_images_df


def create_plotly_molecular_space_map(mol_images_df, width=800, height=600, color_property=None):
    fig = go.Figure()

    if color_property:
        color_range = [
            mol_images_df[color_property].min(),
            mol_images_df[color_property].max(),
        ]

        fig.add_trace(
            go.Scatter(
                x=[None],
                y=[None],
                mode="markers",
                marker=dict(
                    colorscale="Turbo",
                    showscale=True,
                    cmin=color_range[0],
                    cmax=color_range[1],
                    colorbar=dict(thickness=20, len=0.75),
                ),
                showlegend=False,
                hoverinfo="none",
            )
        )

    for group in mol_images_df['Group'].unique():
        group_data = mol_images_df[mol_images_df['Group'] == group]

        marker_config = dict(
            size=9 if group == 'Reference' else 7,
            opacity=0.7,
            symbol='triangle-up' if group == 'Reference' else 'circle'
        )

        if color_property:
            marker_config.update(
                {
                    "color": group_data[color_property],
                    "colorscale": "Turbo",
                    "showscale": False,
                    "cmin": color_range[0],
                    "cmax": color_range[1],
                }
            )
        else:
            marker_config['color'] = '#60a5fa'
            marker_config['showscale'] = False

        fig.add_trace(go.Scatter(
            x=group_data['UMAP1'],
            y=group_data['UMAP2'],
            mode='markers',
            marker=marker_config,
            name=group,
            hoverinfo='text',
            text=[f'SMILES: {smiles}<br>' for smiles in group_data['SMILES']],
            hoverlabel=dict(
                bgcolor="white",
                font_size=16,
                font_family="Arial",
            )
        ))

        if color_property:
            title = f"Molecular Space Map - color scaled by {color_property}"
        else:
            title = "Molecular Space Map"

        fig.update_layout(
            title=title,  # Added title
            xaxis_title='UMAP Dimension 1',
            yaxis_title='UMAP Dimension 2',
            template='plotly_white',
            hovermode='closest',
            legend=dict(
                yanchor="bottom",
                y=0.01,
                xanchor="right",
                x=0.99,
                bgcolor="rgba(255, 255, 255, 0.8)",
                bordercolor="rgba(0, 0, 0, 0.3)",
                borderwidth=1,
            ),
            autosize=True,
            margin=dict(l=50, r=50, t=30, b=50)
        )

        return fig

    #     for group_name in mol_images_df[ColumnName.Group.value].unique():
    #         group = GroupName(group_name)
    #         group_data = mol_images_df[mol_images_df[ColumnName.Group.value] == group_name]
    #         marker_config = get_layout_config(group)

    #         if color_property:
    #             marker_config.update(
    #                 {
    #                     "color": group_data[color_property],
    #                     "colorscale": "Turbo",
    #                     "showscale": False,
    #                     "cmin": color_range[0],
    #                     "cmax": color_range[1],
    #                 }
    #             )

    #         fig.add_trace(
    #             go.Scatter(
    #                 x=group_data[ColumnName.UMAP1.value],
    #                 y=group_data[ColumnName.UMAP2.value],
    #                 mode="markers",
    #                 marker=marker_config,
    #                 name=group,
    #                 hoverinfo="text",
    #                 text=[
    #                     f"SMILES: {smiles}<br>"
    #                     for smiles in group_data[ColumnName.SMILES.value]
    #                 ],
    #                 hoverlabel=dict(bgcolor="white", font_size=16, font_family="Arial"),
    #             )
    #         )


    # scatter = plot_figure.circle(
    #     'x', 'y', 
    #     size=10, 
    #     # color='navy',
    #     color=dict(field='group', transform=color_mapping),
    #     alpha=0.5,
    #     source=datasource
    # )

    # show(plot_figure)