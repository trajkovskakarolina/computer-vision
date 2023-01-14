import React from "react";
import ReactDOM, {render} from "react-dom";
import MagicDropzone from "react-magic-dropzone";

import "./styles.css";
import giff from './dogs-clap.gif'

const tf = require('@tensorflow/tfjs');

const weights = '/best_web_model/model.json';

const names = ['and', 'blanket', 'cold', 'else', 'if', 'pet', 'sad']

class App extends React.Component {
  state = {
    model: null,
    preview: "",
    predictions: [],
    code: '',
    correct: false
  };

  componentDidMount() {
    tf.loadGraphModel(weights).then(model => {
      this.setState({
        model: model
      });
    }).catch(err =>
        console.log(err)
    );
    console.log('hfihdid');
    console.log(this.state.model);
  }
  
  
  onDrop = (accepted, rejected, links) => {
    this.setState({ preview: accepted[0].preview || links[0] });
  };

  cropToCanvas = (image, canvas, ctx) => {
    const naturalWidth = image.naturalWidth;
    const naturalHeight = image.naturalHeight;

    // canvas.width = image.width;
    // canvas.height = image.height;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const ratio = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
    const newWidth = Math.round(naturalWidth * ratio);
    const newHeight = Math.round(naturalHeight * ratio);
    ctx.drawImage(
      image,
      0,
      0,
      naturalWidth,
      naturalHeight,
      (canvas.width - newWidth) / 2,
      (canvas.height - newHeight) / 2,
      newWidth,
      newHeight,
    );

  };

  onImageChange = e => {
    const c = document.getElementById("canvas");
    const ctx = c.getContext("2d");
    this.cropToCanvas(e.target, c, ctx);
    let [modelWidth, modelHeight] = this.state.model.inputs[0].shape.slice(1, 3);
    console.log("model width", modelWidth);
    console.log("model height", modelHeight);
    const input = tf.tidy(() => {
      return tf.image.resizeBilinear(tf.browser.fromPixels(c), [modelWidth, modelHeight])
        .div(255.0).expandDims(0);
    });
    this.state.model.executeAsync(input).then(res => {
      // Font options.
      const font = "12px sans-serif";
      ctx.font = font;
      ctx.textBaseline = "top";

      const [boxes, scores, classes, valid_detections] = res;
      const boxes_data = boxes.dataSync();
      const scores_data = scores.dataSync();
      const classes_data = classes.dataSync();
      const valid_detections_data = valid_detections.dataSync()[0];
      
      tf.dispose(res)

      var i;
      for (i = 0; i < valid_detections_data; ++i){
        let [x1, y1, x2, y2] = boxes_data.slice(i * 4, (i + 1) * 4);
        x1 *= c.width;
        x2 *= c.width;
        y1 *= c.height;
        y2 *= c.height;
        const width = x2 - x1;
        const height = y2 - y1;
        const klass = names[classes_data[i]];
        const score = scores_data[i].toFixed(2);

        //console.log('point'+i, x1 , y1);
        //console.log('width'+i, width);
        //console.log('class'+i, klass);
        //console.log('score'+i, score);
        
        const arr = {class: klass, values : [x1,y1,width,height]};
        this.state.predictions.push(arr);
        
        // Draw the bounding box.
        ctx.strokeStyle = "#00FFFF";
        ctx.lineWidth = 4;
        ctx.strokeRect(x1, y1, width, height);
        
        //draw point 1
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 4;
        ctx.strokeRect(x1, y1, width/8, height/8);
        
        // Draw the label background.
        ctx.fillStyle = "#00FFFF";
        const textWidth = ctx.measureText(klass + ":" + score).width;
        const textHeight = parseInt(font, 10); // base 10
        ctx.fillRect(x1, y1, textWidth + 2, textHeight + 2);

      }
      for (i = 0; i < valid_detections_data; ++i){
        let [x1, y1, , ] = boxes_data.slice(i * 4, (i + 1) * 4);
        x1 *= c.width;
        y1 *= c.height;
        const klass = names[classes_data[i]];
        const score = scores_data[i].toFixed(2);

        // Draw the text last to ensure it's on top.
        ctx.fillStyle = "#000000";
        ctx.fillText(klass + ":" + score, x1, y1);

      }
      //console.log(this.state.predictions);
      this.correct();
    });
  };
  
  correct = () => {
    let dict = {};
    let ifElse = false;
    
    for(const elm of this.state.predictions){
      if(elm.class==='if'){
        dict['if']=[];
        for(const elm2 of this.state.predictions){
          if (elm2.class==='and' || elm2.class==='sad' || elm2.class==='cold'){
            if (elm2.values[0]>elm.values[0] && 
                elm2.values[0]<elm.values[0]+elm.values[2]/2 && 
                elm2.values[1]>elm.values[1] &&
                elm2.values[1]<elm.values[1]+elm.values[3]){
              dict['if'].push(elm2.class);
            }
          }
          if(elm2.class==='blanket' || elm2.class==='pet'){
            if(elm2.values[0]>elm.values[0] && 
                elm2.values[0]<elm.values[0]+elm.values[2] &&
                elm2.values[1]<elm.values[1]+elm.values[3]*(1/4) && 
                elm2.values[1]>elm.values[1]-elm.values[3]*(1/4)){
              dict['if'].push(elm2.class);
            }
          }
          if(elm2.class==='else') {
            if (elm2.values[0]>elm.values[0]-elm.values[2]*(1/4) &&
                elm2.values[0]<elm.values[0]+elm.values[2]*(1/4) &&
                elm2.values[1]>elm.values[1] &&
                elm2.values[1]<elm.values[1]+elm.values[3]){
              ifElse = true; //if and else are connected
            }
          }
        }
      }
      else if (elm.class==='else'){
        dict['else']=[];
        for(const elm2 of this.state.predictions) {
          if(elm2.class==='blanket' || elm2.class==='pet'){
            if(elm2.values[0]>elm.values[0] &&
                elm2.values[0]<elm.values[0]+elm.values[2] &&
                elm2.values[1]<elm.values[1]+elm.values[3]*(1/4) &&
                elm2.values[1]>elm.values[1]-elm.values[3]*(1/4)){
              dict['else'].push(elm2.class);
            }
          }
        }
      }
    }
    
    console.log(dict);
    
    let general = '';
    let tmp2 = '';
    for (let i in dict){
      if(i==='if') {
        general += 'if (';
        let tmp = '';
        let condition = false;
        for (let j in dict[i]){
          //console.log(dict[i][j]);
          if (dict[i][j]==='blanket') tmp += ' give blanket; '
          else if (dict[i][j]==='pet') tmp += ' pet; '
          else {
            if (dict[i][j]!=='and' && condition===false) {
                general += dict[i][j];
                condition = true;
            }
            else if (dict[i][j]!=='and') general = general + ' and ' + dict[i][j] ;
          }
        }
        general += ') : \n' + tmp + '\n';
        if (!ifElse) general += 'return;'
      }
      else if(i==='else'){
        tmp2 += 'else : \n';
        for (let j in dict[i]) {
          if (dict[i][j]==='blanket') tmp2 += ' give blanket; '
          else if (dict[i][j]==='pet') tmp2 += ' pet; '
        }
      }
    }
    general+=tmp2 + '\n';  //to assure else comes after if
    general+= 'return;';
    
    console.log('general: ', general);

    this.setState({
      code: general
    });
    
    if (general === 'if (sad and cold) : \n' +
        ' give blanket; \n' +
        'else : \n' +
        ' pet; \n' +
        'return;'){
      this.setState({
        correct: true
      });
    }
        
  }

  render() {
    return (
        <div>
          <h1 className='title'>Recognition of tangible programming blocks (the pARt Blocks)</h1>
          <p className='title'>Student: Karolina Trajkovska     Class: Computer Vision</p>
          <div className='main-container'>
            <div className="Dropzone-page">
              {this.state.model ? (
                  <MagicDropzone
                      className="Dropzone"
                      accept="image/jpeg, image/png, .jpg, .jpeg, .png"
                      multiple={false}
                      onDrop={this.onDrop}
                  >
                    {this.state.preview ? (
                        <img
                            alt="upload preview"
                            onLoad={this.onImageChange}
                            className="Dropzone-img"
                            src={this.state.preview}
                        />
                    ) : (
                        "Choose or drop a file."
                    )}
                    <canvas id="canvas" width="640" height="640" />
                  </MagicDropzone>
              ) : (
                  <div className="Dropzone">Loading model...</div>
              )}
            </div>
            <div style={{border: '.5px dashed', padding:'30px', width: '40%', margin: '40px', marginTop: '10px'}}>
              <p>Please refresh the page before loading a new image</p>
              <br/>
              <p>Task: Anna is visiting the dog shelter. If the dogs are cold and sad, she should give them a blanket. 
                Otherwise, she should pet them.</p>
              <br/>  
              <p>Code detected:</p>
              <p style={{color: 'darkblue', whiteSpace: 'pre-wrap'}}>{this.state.code}</p>
              <br/>
              {this.state.correct ? (
                  <div>
                    <p>Task solved!</p>
                    <img src={giff}/>
                  </div>
              ) : (
                  <div>
                    Task is not solved yet.
                  </div>
              )}
            </div>
          </div>
        </div>
      
    );
  }
}

const rootElement = document.getElementById("root");
ReactDOM.render(<App />, rootElement);
