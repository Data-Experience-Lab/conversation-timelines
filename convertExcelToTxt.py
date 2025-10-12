import csv
import pandas as pd

def main():
    responses = open("responses.txt", "w", encoding="utf-8")
    with open('data.csv', mode='r', encoding="utf-8", errors="ignore") as csvfile:
        df = pd.DataFrame(list(csv.DictReader(csvfile)))       
        pd.set_option('display.max_colwidth', None)
        for column in df.columns:
            responses.write("\n\n\n***********************")
            responses.write(f"\n\nQuestion: {column}\n\n")
            for index, row in df.iterrows():
                if (row[column]!=None and len(row[column]) > 0):
                    responses.write(f"- {row[column]}\n\n")
        
if __name__ == "__main__":
    main()