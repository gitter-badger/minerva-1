from d3rlpy.datasets import get_cartpole
from ganglion.dataset import export_mdp_dataset_as_csv

# prepare MDPDataset
dataset, _ = get_cartpole()

# save as CSV
export_mdp_dataset_as_csv(dataset, 'cartpole.csv')
